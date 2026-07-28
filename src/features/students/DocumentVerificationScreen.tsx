// src/features/documents/DocumentVerificationScreen.tsx

import React, { useState, useRef } from 'react';
import {
  FileText, Search, Save, CheckCircle2, XCircle, AlertCircle, Upload,
  Trash2, Eye, ExternalLink, FileImage, File, Shield, Info,
  ToggleLeft, ToggleRight, X, ChevronLeft, ChevronRight, Download
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

// ✅ HOOK IMPORT
import { useTraineeSearch } from '../../hooks/useTraineeSearch';

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const MAX_FILE_SIZE_KB = 500;
const ALLOWED_TYPES    = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const REQUIRED_DOCUMENTS = [
  { key: 'aadharCard',            label: 'Aadhar Card (Front & Back)',              category: 'Identity',     defaultRequired: true,  multiple: true  },
  { key: 'panCard',               label: 'PAN Card',                                category: 'Identity',     defaultRequired: false, multiple: false },
  { key: 'voterIdCard',           label: 'Voter ID Card',                           category: 'Identity',     defaultRequired: false, multiple: false },
  { key: 'domicileCertificate',   label: 'Domicile / Mool Niwas Praman Patra',     category: 'Identity',     defaultRequired: true,  multiple: false },
  { key: 'casteCertificate',      label: 'Caste Certificate (SC/ST/OBC)',           category: 'Identity',     defaultRequired: false, multiple: false },
  { key: 'marksheet10th',         label: '10th Marksheet & Certificate',            category: 'Education',    defaultRequired: true,  multiple: true  },
  { key: 'marksheet12th',         label: '12th Marksheet & Certificate',            category: 'Education',    defaultRequired: false, multiple: true  },
  { key: 'graduationMarksheet',   label: 'Graduation Marksheet (if applicable)',    category: 'Education',    defaultRequired: false, multiple: true  },
  { key: 'characterCertificate',  label: 'Character Certificate (School/College)',  category: 'Education',    defaultRequired: true,  multiple: false },
  { key: 'medicalFitnessCert',    label: 'Medical Fitness Certificate',             category: 'Medical',      defaultRequired: true,  multiple: true  },
  { key: 'eyeTestReport',         label: 'Eye Test Report',                         category: 'Medical',      defaultRequired: true,  multiple: false },
  { key: 'bloodGroupReport',      label: 'Blood Group Report',                      category: 'Medical',      defaultRequired: true,  multiple: false },
  { key: 'policeVerification',    label: 'Police Verification Report',              category: 'Verification', defaultRequired: true,  multiple: true  },
  { key: 'noCriminalRecord',      label: 'No Criminal Record Certificate',          category: 'Verification', defaultRequired: true,  multiple: false },
  { key: 'nocPrevEmployer',       label: 'NOC from Previous Employer (if any)',     category: 'Verification', defaultRequired: false, multiple: false },
  { key: 'passportPhoto',         label: 'Passport Size Photo (Recent)',            category: 'Photos',       defaultRequired: true,  multiple: false },
  { key: 'fullBodyPhoto',         label: 'Full Body Photo (Standing)',              category: 'Photos',       defaultRequired: true,  multiple: false },
  { key: 'bankPassbook',          label: 'Bank Passbook / Cancelled Cheque',        category: 'Financial',    defaultRequired: true,  multiple: true  },
  { key: 'recruitmentAdmitCard',  label: 'BSF Recruitment Admit Card',              category: 'Recruitment',  defaultRequired: true,  multiple: true  },
  { key: 'offerLetter',           label: 'Appointment / Offer Letter',              category: 'Recruitment',  defaultRequired: true,  multiple: true  },
];

const CATEGORIES = ['Identity', 'Education', 'Medical', 'Verification', 'Photos', 'Financial', 'Recruitment'];

const getCategoryColor = (cat: string) => {
  const map: Record<string, string> = {
    'Identity':     'border-blue-400 bg-blue-50 text-blue-800',
    'Education':    'border-purple-400 bg-purple-50 text-purple-800',
    'Medical':      'border-red-400 bg-red-50 text-red-800',
    'Verification': 'border-amber-400 bg-amber-50 text-amber-800',
    'Photos':       'border-green-400 bg-green-50 text-green-800',
    'Financial':    'border-teal-400 bg-teal-50 text-teal-800',
    'Recruitment':  'border-military-400 bg-military-50 text-military-800',
  };
  return map[cat] || 'border-slate-300 bg-slate-50 text-slate-700';
};

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
interface FileInfo {
  fileName: string;
  fileUrl: string;
  fileSize: string;
  fileType: string;
  uploadedAt: string;
}

interface DocStatusItem {
  status: 'Pending' | 'Uploaded' | 'Verified' | 'Rejected';
  isRequired: boolean;
  files: FileInfo[];
}

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const DocumentVerificationScreen = () => {

  // ✅ useTraineeSearch HOOK — batch lock + search
  const {
    trainee:    searchedTrainee,
    traineeId:  searchedTraineeId,
    loading:    searchLoading,
    error:      searchError,
    activeBatch,
    hasBatch,
    searchTrainee,
    setTrainee: setSearchedTrainee,
  } = useTraineeSearch();

  const [searchQuery, setSearchQuery]   = useState('');
  const [message, setMessage]           = useState('');
  const [isSaving, setIsSaving]         = useState(false);
  const [activeCategory, setActiveCategory] = useState('All');

  // Preview Modal
  const [previewModal, setPreviewModal] = useState<{
    open: boolean; files: FileInfo[]; currentIndex: number; docLabel: string;
  }>({ open: false, files: [], currentIndex: 0, docLabel: '' });

  const [docStatus, setDocStatus]           = useState<Record<string, DocStatusItem>>({});
  const [uploadingKey, setUploadingKey]     = useState('');
  const fileInputRef                        = useRef<HTMLInputElement>(null);
  const [currentUploadKey, setCurrentUploadKey]         = useState('');
  const [currentUploadMultiple, setCurrentUploadMultiple] = useState(false);

  // ── Doc Status Initialize ──
  const initDocStatus = (existingDocs: any) => {
    const status: Record<string, DocStatusItem> = {};
    REQUIRED_DOCUMENTS.forEach(d => {
      if (existingDocs?.[d.key]) {
        const existing = existingDocs[d.key];
        status[d.key] = {
          status:     existing.status || 'Pending',
          isRequired: existing.isRequired !== undefined ? existing.isRequired : d.defaultRequired,
          files:      existing.files || (existing.fileName ? [{
            fileName:   existing.fileName,
            fileUrl:    existing.fileUrl    || '',
            fileSize:   existing.fileSize   || '',
            fileType:   existing.fileType   || 'image/jpeg',
            uploadedAt: existing.uploadedAt || '',
          }] : []),
        };
      } else {
        status[d.key] = { status: 'Pending', isRequired: d.defaultRequired, files: [] };
      }
    });
    return status;
  };

  // ── Search Handler — HOOK USE KARTA HAI ──
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setMessage('');

    const found = await searchTrainee(searchQuery);

    if (found) {
      // Hook ne trainee set kar diya — ab docStatus init karo
      // Lekin hook se trainee directly lena hoga useEffect se
    }
  };

  // ✅ Jab bhi searchedTrainee change ho (hook se), docStatus init karo
  React.useEffect(() => {
    if (searchedTrainee) {
      setDocStatus(initDocStatus(searchedTrainee.documents));
    }
  }, [searchedTrainee]);

  // ── searchError ko local message mein dikhao ──
  React.useEffect(() => {
    if (searchError) setMessage(searchError);
  }, [searchError]);

  // ── File Select ──
  const handleFileSelect = (docKey: string, isMultiple: boolean) => {
    setCurrentUploadKey(docKey);
    setCurrentUploadMultiple(isMultiple);
    if (fileInputRef.current) {
      fileInputRef.current.multiple = isMultiple;
      fileInputRef.current.click();
    }
  };

  // ── File Upload ──
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0 || !currentUploadKey) return;

    const filesArray = Array.from(selectedFiles);

    // Validate
    for (const file of filesArray) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setMessage(`ERROR: "${file.name}" - Sirf JPG, PNG, WEBP ya PDF allowed hai!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      const fileSizeKB = Math.round(file.size / 1024);
      if (fileSizeKB > MAX_FILE_SIZE_KB) {
        setMessage(`ERROR: "${file.name}" ki size ${fileSizeKB}KB hai. Max ${MAX_FILE_SIZE_KB}KB allowed!`);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setUploadingKey(currentUploadKey);
    setMessage('');

    const newFiles: FileInfo[] = [];

    for (const file of filesArray) {
      const fileSizeKB = Math.round(file.size / 1024);
      try {
        const storage    = getStorage();
        const storageRef = ref(
          storage,
          `documents/${searchedTrainee?.regNo}/${currentUploadKey}_${Date.now()}_${file.name}`
        );
        await uploadBytes(storageRef, file);
        const downloadUrl = await getDownloadURL(storageRef);
        newFiles.push({
          fileName:   file.name,
          fileUrl:    downloadUrl,
          fileSize:   `${fileSizeKB}KB`,
          fileType:   file.type,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        // Offline fallback — local URL
        const localUrl = URL.createObjectURL(file);
        newFiles.push({
          fileName:   file.name,
          fileUrl:    localUrl,
          fileSize:   `${fileSizeKB}KB`,
          fileType:   file.type,
          uploadedAt: new Date().toISOString(),
        });
      }
    }

    setDocStatus(prev => ({
      ...prev,
      [currentUploadKey]: {
        ...prev[currentUploadKey],
        status: 'Uploaded',
        files:  currentUploadMultiple
          ? [...(prev[currentUploadKey]?.files || []), ...newFiles]
          : newFiles,
      },
    }));

    setMessage(`SUCCESS: ${newFiles.length} file(s) upload ho gayi!`);
    setUploadingKey('');
    setCurrentUploadKey('');
    setCurrentUploadMultiple(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Remove File ──
  const handleRemoveFile = (docKey: string, fileIndex?: number) => {
    setDocStatus(prev => {
      const current = prev[docKey];
      if (fileIndex !== undefined && current.files.length > 1) {
        const updatedFiles = current.files.filter((_, i) => i !== fileIndex);
        return {
          ...prev,
          [docKey]: {
            ...current,
            files:  updatedFiles,
            status: updatedFiles.length > 0 ? current.status : 'Pending',
          },
        };
      }
      return { ...prev, [docKey]: { ...current, status: 'Pending', files: [] } };
    });
  };

  const handleStatusChange = (docKey: string, newStatus: string) => {
    setDocStatus(prev => ({
      ...prev,
      [docKey]: { ...prev[docKey], status: newStatus as DocStatusItem['status'] },
    }));
  };

  const toggleRequired = (docKey: string) => {
    setDocStatus(prev => ({
      ...prev,
      [docKey]: { ...prev[docKey], isRequired: !prev[docKey].isRequired },
    }));
  };

  // ── Preview ──
  const openPreview  = (files: FileInfo[], index: number, label: string) =>
    setPreviewModal({ open: true, files, currentIndex: index, docLabel: label });

  const closePreview = () =>
    setPreviewModal({ open: false, files: [], currentIndex: 0, docLabel: '' });

  const nextPreview = () =>
    setPreviewModal(prev => ({ ...prev, currentIndex: (prev.currentIndex + 1) % prev.files.length }));

  const prevPreview = () =>
    setPreviewModal(prev => ({
      ...prev,
      currentIndex: prev.currentIndex === 0 ? prev.files.length - 1 : prev.currentIndex - 1,
    }));

  // ── Save Documents ──
  const handleSaveDocuments = async () => {
    if (!searchedTrainee || !searchedTraineeId) return;
    setIsSaving(true);
    setMessage('');

    const requiredDocs    = REQUIRED_DOCUMENTS.filter(d => docStatus[d.key]?.isRequired);
    const totalRequired   = requiredDocs.length;
    const completedRequired = requiredDocs.filter(d =>
      docStatus[d.key]?.status === 'Uploaded' || docStatus[d.key]?.status === 'Verified'
    ).length;
    const allVerified = requiredDocs.every(d => docStatus[d.key]?.status === 'Verified');

    try {
      // ✅ Hook ka traineeId use karo — Firestore doc ID correct rahegi
      const traineeRef = doc(db, 'trainees', searchedTraineeId);
      await updateDoc(traineeRef, {
        documents:        docStatus,
        docsComplete:     allVerified,
        docsRequiredTotal: totalRequired,
        docsRequiredDone:  completedRequired,
        docsUpdatedDate:   new Date().toISOString(),
      });

      setMessage(
        `SUCCESS: Documents save ho gaye! (${completedRequired}/${totalRequired} required documents done)`
      );
      setTimeout(() => {
        setSearchedTrainee(null);
        setSearchQuery('');
        setMessage('');
        setDocStatus({});
      }, 3000);
    } catch {
      setMessage('ERROR: Data save nahi ho paya. Dobara try karein.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Stats ──
  const getStats = () => {
    const allDocs         = REQUIRED_DOCUMENTS;
    const requiredDocs    = allDocs.filter(d => docStatus[d.key]?.isRequired);
    const notRequiredDocs = allDocs.filter(d => !docStatus[d.key]?.isRequired);
    const totalRequired   = requiredDocs.length;
    const uploaded  = requiredDocs.filter(d => docStatus[d.key]?.status === 'Uploaded').length;
    const verified  = requiredDocs.filter(d => docStatus[d.key]?.status === 'Verified').length;
    const rejected  = requiredDocs.filter(d => docStatus[d.key]?.status === 'Rejected').length;
    const pending   = requiredDocs.filter(d => docStatus[d.key]?.status === 'Pending').length;
    const done      = uploaded + verified;
    const skipped   = notRequiredDocs.length;
    return { totalAll: allDocs.length, totalRequired, uploaded, verified, rejected, pending, done, skipped };
  };

  const filteredDocs = activeCategory === 'All'
    ? REQUIRED_DOCUMENTS
    : REQUIRED_DOCUMENTS.filter(d => d.category === activeCategory);

  const stats = getStats();

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════
  return (
    <div className="w-full flex flex-col space-y-4 p-4">

      {/* Hidden file input */}
      <input
        type="file" ref={fileInputRef} onChange={handleFileUpload}
        accept=".jpg,.jpeg,.png,.webp,.pdf" className="hidden"
      />

      {/* ✅ Active Batch Banner */}
      {activeBatch ? (
        <div className="bg-green-900 border border-green-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-black text-green-300 uppercase">Active Batch:</span>
            <span className="text-xs font-black text-white">{activeBatch.batchNumber}</span>
            <span className="text-[10px] text-green-400">{activeBatch.batchName}</span>
          </div>
          <span className="text-[9px] text-green-400 font-bold">
            Sirf is batch ke trainees search honge
          </span>
        </div>
      ) : (
        // ✅ No Batch Warning
        <div className="bg-red-900 border border-red-600 px-4 py-2 flex items-center gap-3">
          <AlertCircle size={14} className="text-red-300 flex-shrink-0" />
          <span className="text-[10px] font-black text-red-300 uppercase">
            Koi Active Batch Nahi! Pehle Batch Management mein batch activate karo.
          </span>
        </div>
      )}

      {/* Header */}
      <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center">
          <Shield size={20} className="text-white mr-3" />
          <div>
            <h1 className="text-sm font-black text-white uppercase tracking-widest">Document Verification Cell</h1>
            <p className="text-[10px] text-military-300 uppercase tracking-wider">BSF Rangroot - Upload & Verification System</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-military-300">Max Size: <strong className="text-yellow-400">{MAX_FILE_SIZE_KB}KB</strong> per file</p>
          <p className="text-[10px] text-military-300">Formats: JPG, PNG, WEBP, PDF</p>
        </div>
      </div>

      {/* Compress Tool Banner */}
      <div className="bg-amber-50 border border-amber-300 px-4 py-3 flex items-start space-x-3">
        <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-[11px] text-amber-800 font-bold uppercase">
            File Size Limit: {MAX_FILE_SIZE_KB}KB | Multiple Files Supported (Front & Back)
          </p>
          <p className="text-[10px] text-amber-700 mt-0.5">
            Agar file badi hai toh compress karo. Har document me <strong>"Zaruri Hai"</strong> toggle se decide karo
            ki wo required hai ya nahi.
          </p>
          <div className="mt-2 flex items-center space-x-4">
            <a
              href="https://studygyaan.in/tools/"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center bg-amber-600 text-white px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-amber-700 transition-colors rounded-sm"
            >
              <ExternalLink size={12} className="mr-1.5" />
              Image & PDF Compressor - Click Here
            </a>
            <span className="text-[9px] text-amber-600 font-semibold">studygyaan.in/tools/ - Free Compression Tools</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div className={`p-3 text-xs font-bold border flex items-center ${
          message.startsWith('ERROR')
            ? 'bg-red-50 text-red-600 border-red-200'
            : 'bg-green-50 text-green-700 border-green-200'
        }`}>
          {message.startsWith('ERROR')
            ? <XCircle size={14} className="mr-2 flex-shrink-0" />
            : <CheckCircle2 size={14} className="mr-2 flex-shrink-0" />}
          {message}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">

        {/* ═══ LEFT PANEL ═══ */}
        <div className="col-span-1 space-y-4">

          {/* Search */}
          <div className="bg-white border border-slate-300 shadow-flat p-4 space-y-3">
            <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Search Rangroot</label>
            <p className="text-[9px] text-slate-400">
              {hasBatch
                ? `Batch "${activeBatch?.batchNumber}" mein search karein`
                : 'Pehle batch select karo'}
            </p>
            <div className="flex mt-1">
              <input
                type="text"
                placeholder={hasBatch ? 'Chest No / Reg No...' : 'Batch select karo pehle...'}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                disabled={!hasBatch}
                className="w-full text-sm font-mono font-bold px-3 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSearch}
                disabled={searchLoading || !hasBatch}
                className="bg-military-800 text-white px-3 border border-l-0 border-military-800 hover:bg-military-900 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {searchLoading ? '...' : <Search size={16} />}
              </button>
            </div>

            {/* Trainee Info Card */}
            {searchedTrainee && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200">
                <p className="text-xs font-black text-green-800 uppercase">{searchedTrainee.name}</p>
                <div className="mt-1 space-y-0.5 text-[10px] text-green-700">
                  <p>Batch: <span className="font-bold">{searchedTrainee.batchNumber || '--'}</span></p>
                  <p>Reg: <span className="font-mono font-bold">{searchedTrainee.regNo}</span></p>
                  {searchedTrainee.chestNo && (
                    <p>Chest: <span className="font-mono font-bold">{searchedTrainee.chestNo}</span></p>
                  )}
                  <p>Platoon: <span className="font-bold">{searchedTrainee.platoon || '--'}</span></p>
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          {searchedTrainee && (
            <div className="bg-white border border-slate-300 shadow-flat p-4 space-y-3">
              <h3 className="text-[10px] font-bold text-slate-600 uppercase tracking-wider border-b border-slate-200 pb-2">
                Document Summary
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-500 font-semibold">Total Documents</span>
                  <span className="text-xs font-black text-military-900">{stats.totalAll}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-red-600 font-semibold">Required (Zaruri)</span>
                  <span className="text-xs font-black text-red-600">{stats.totalRequired}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-semibold">Not Required (Skipped)</span>
                  <span className="text-xs font-black text-slate-400">{stats.skipped}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-green-600 font-semibold flex items-center">
                    <CheckCircle2 size={10} className="mr-1" />Uploaded
                  </span>
                  <span className="text-xs font-black text-green-600">{stats.uploaded}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-blue-600 font-semibold flex items-center">
                    <Shield size={10} className="mr-1" />Verified
                  </span>
                  <span className="text-xs font-black text-blue-600">{stats.verified}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-red-500 font-semibold flex items-center">
                    <XCircle size={10} className="mr-1" />Rejected
                  </span>
                  <span className="text-xs font-black text-red-500">{stats.rejected}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-amber-600 font-semibold flex items-center">
                    <AlertCircle size={10} className="mr-1" />Pending
                  </span>
                  <span className="text-xs font-black text-amber-600">{stats.pending}</span>
                </div>
                <div className="h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-military-800">Required Done</span>
                  <span className={`text-xs font-black ${stats.done === stats.totalRequired ? 'text-green-600' : 'text-red-600'}`}>
                    {stats.done}/{stats.totalRequired}
                  </span>
                </div>
                <div className="w-full bg-slate-200 h-2.5 mt-1 rounded-sm overflow-hidden">
                  <div
                    className={`h-full transition-all rounded-sm ${
                      stats.done === stats.totalRequired ? 'bg-green-500' :
                      stats.done > 0 ? 'bg-amber-500' : 'bg-red-400'
                    }`}
                    style={{ width: `${stats.totalRequired > 0 ? (stats.done / stats.totalRequired) * 100 : 0}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 text-center">
                  {stats.totalRequired > 0 ? Math.round((stats.done / stats.totalRequired) * 100) : 0}% Complete
                </p>
              </div>
            </div>
          )}

          {/* Compress Tool Card */}
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-600 shadow-flat p-4 text-center">
            <FileImage size={24} className="text-slate-400 mx-auto mb-2" />
            <p className="text-[10px] text-slate-300 font-bold uppercase tracking-wider mb-1">File Badi Hai?</p>
            <p className="text-[9px] text-slate-400 mb-3">Image ya PDF FREE mein compress karein</p>
            <a
              href="https://studygyaan.in/tools/"
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center bg-white text-slate-800 px-4 py-2 text-[10px] font-bold uppercase hover:bg-slate-100 transition-colors"
            >
              <ExternalLink size={12} className="mr-1.5" />
              StudyGyaan Tools
            </a>
          </div>
        </div>

        {/* ═══ RIGHT PANEL: Documents ═══ */}
        <div className="col-span-3 bg-white border border-slate-300 shadow-flat flex flex-col">

          {/* Toolbar */}
          <div className="bg-slate-100 border-b border-slate-300 px-4 py-2 flex justify-between items-center flex-wrap gap-2">
            <div className="flex items-center space-x-1.5 overflow-x-auto">
              <button
                onClick={() => setActiveCategory('All')}
                className={`px-2 py-1 text-[9px] font-bold uppercase whitespace-nowrap border transition-colors ${
                  activeCategory === 'All'
                    ? 'bg-military-800 text-white border-military-800'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                All ({REQUIRED_DOCUMENTS.length})
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-2 py-1 text-[9px] font-bold uppercase whitespace-nowrap border transition-colors ${
                    activeCategory === cat
                      ? 'bg-military-800 text-white border-military-800'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {cat} ({REQUIRED_DOCUMENTS.filter(d => d.category === cat).length})
                </button>
              ))}
            </div>
            <button
              onClick={handleSaveDocuments}
              disabled={!searchedTrainee || isSaving}
              className="bg-green-600 text-white px-4 py-1.5 text-[10px] font-bold uppercase hover:bg-green-700 disabled:opacity-40 flex items-center flex-shrink-0 transition-colors"
            >
              {isSaving ? 'Saving...' : <><Save size={12} className="mr-1.5" />Save All</>}
            </button>
          </div>

          {/* Documents List */}
          <div className={`p-4 flex-1 overflow-y-auto max-h-[70vh] ${!searchedTrainee && 'opacity-20 pointer-events-none'}`}>
            {!searchedTrainee && (
              <div className="text-center py-12">
                <FileText size={48} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-400 uppercase">
                  {hasBatch ? 'Pehle Rangroot Search Karein' : 'Pehle Batch Select Karo'}
                </p>
                <p className="text-[10px] text-slate-400 mt-1">
                  {hasBatch ? 'Chest No ya Reg No dalein' : 'Batch Management mein jaake batch activate karo'}
                </p>
              </div>
            )}

            {searchedTrainee && (
              <div className="space-y-3">
                {filteredDocs.map(docItem => {
                  const status     = docStatus[docItem.key] || { status: 'Pending', isRequired: docItem.defaultRequired, files: [] };
                  const isPending  = status.status === 'Pending';
                  const isUploaded = status.status === 'Uploaded';
                  const isVerified = status.status === 'Verified';
                  const isRejected = status.status === 'Rejected';
                  const isRequired = status.isRequired;

                  return (
                    <div
                      key={docItem.key}
                      className={`border p-3 transition-all ${
                        !isRequired   ? 'border-slate-200 bg-slate-50 opacity-60' :
                        isVerified    ? 'border-green-300 bg-green-50' :
                        isRejected    ? 'border-red-300 bg-red-50' :
                        isUploaded    ? 'border-blue-300 bg-blue-50' :
                                        'border-slate-200 bg-white'
                      }`}
                    >
                      {/* Top Row */}
                      <div className="flex items-start justify-between">
                        <div className="flex-1 mr-3">
                          {/* Tags */}
                          <div className="flex items-center space-x-2 flex-wrap gap-1">
                            <span className={`px-1.5 py-0.5 text-[8px] font-bold uppercase border ${getCategoryColor(docItem.category)}`}>
                              {docItem.category}
                            </span>
                            {docItem.multiple && (
                              <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase bg-indigo-100 text-indigo-600 border border-indigo-200">
                                Multiple Files
                              </span>
                            )}
                          </div>

                          <h4 className="text-xs font-bold text-slate-800 mt-1.5">{docItem.label}</h4>

                          {/* Files list */}
                          {status.files && status.files.length > 0 && (
                            <div className="mt-2 space-y-1">
                              {status.files.map((file: FileInfo, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center space-x-2 text-[9px] text-slate-500 bg-white px-2 py-1 border border-slate-200 rounded-sm"
                                >
                                  {file.fileType === 'application/pdf'
                                    ? <File size={10} className="text-red-500 flex-shrink-0" />
                                    : <FileImage size={10} className="text-blue-500 flex-shrink-0" />}
                                  <span className="truncate max-w-[150px]">{file.fileName}</span>
                                  <span className="font-mono font-bold text-slate-600">{file.fileSize}</span>
                                  <button
                                    onClick={() => openPreview(status.files, idx, docItem.label)}
                                    className="text-blue-500 hover:text-blue-700 p-0.5 transition-colors"
                                    title="Dekho / Preview"
                                  >
                                    <Eye size={12} />
                                  </button>
                                  {status.files.length > 1 && (
                                    <button
                                      onClick={() => handleRemoveFile(docItem.key, idx)}
                                      className="text-red-400 hover:text-red-600 p-0.5 transition-colors"
                                      title="Hatao"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right Side Controls */}
                        <div className="flex flex-col items-end space-y-2 flex-shrink-0">

                          {/* Zaruri Hai Toggle */}
                          <button
                            onClick={() => toggleRequired(docItem.key)}
                            className={`flex items-center space-x-1 px-2 py-1 text-[9px] font-bold uppercase border transition-colors ${
                              isRequired
                                ? 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100'
                                : 'bg-slate-100 text-slate-400 border-slate-200 hover:bg-slate-200'
                            }`}
                          >
                            {isRequired
                              ? <ToggleRight size={14} className="text-red-600" />
                              : <ToggleLeft  size={14} className="text-slate-400" />}
                            <span>{isRequired ? 'Zaruri Hai' : 'Zaruri Nahi'}</span>
                          </button>

                          {/* Status Badge */}
                          {isRequired && (
                            <div className={`px-2 py-1 text-[9px] font-bold uppercase ${
                              isVerified ? 'bg-green-600 text-white' :
                              isRejected ? 'bg-red-600 text-white'   :
                              isUploaded ? 'bg-blue-600 text-white'  :
                                           'bg-slate-300 text-slate-600'
                            }`}>
                              {isVerified && '✓ Verified'}
                              {isRejected && '✗ Rejected'}
                              {isUploaded && '↑ Uploaded'}
                              {isPending  && '⏳ Pending'}
                            </div>
                          )}

                          {/* Action Buttons */}
                          {isRequired && (
                            <div className="flex items-center space-x-1.5">
                              {(isPending || isRejected || (isUploaded && docItem.multiple)) && (
                                <button
                                  onClick={() => handleFileSelect(docItem.key, docItem.multiple)}
                                  disabled={uploadingKey === docItem.key}
                                  className="bg-military-700 text-white px-2 py-1 text-[9px] font-bold uppercase hover:bg-military-800 flex items-center disabled:opacity-50 transition-colors"
                                >
                                  {uploadingKey === docItem.key
                                    ? '...'
                                    : <><Upload size={10} className="mr-1" />{status.files.length > 0 ? 'Add More' : 'Upload'}</>}
                                </button>
                              )}

                              {status.files && status.files.length > 0 && (
                                <button
                                  onClick={() => openPreview(status.files, 0, docItem.label)}
                                  className="bg-slate-600 text-white px-2 py-1 text-[9px] font-bold uppercase hover:bg-slate-700 flex items-center transition-colors"
                                >
                                  <Eye size={10} className="mr-1" />View ({status.files.length})
                                </button>
                              )}

                              {(isUploaded || isVerified || isRejected) && (
                                <select
                                  value={status.status}
                                  onChange={e => handleStatusChange(docItem.key, e.target.value)}
                                  className="text-[9px] font-bold border border-slate-300 px-1 py-1 bg-white focus:outline-none"
                                >
                                  <option value="Uploaded">Uploaded</option>
                                  <option value="Verified">✓ Verified</option>
                                  <option value="Rejected">✗ Rejected</option>
                                </select>
                              )}

                              {status.files.length > 0 && (
                                <button
                                  onClick={() => handleRemoveFile(docItem.key)}
                                  className="text-red-400 hover:text-red-600 p-1 transition-colors"
                                  title="Sab hatao"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bottom Bar */}
          {searchedTrainee && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center space-x-2 text-[9px] text-slate-500">
                <Info size={12} />
                <span>Max: <strong>{MAX_FILE_SIZE_KB}KB</strong> | JPG, PNG, WEBP, PDF</span>
                <span>|</span>
                <a
                  href="https://studygyaan.in/tools/"
                  target="_blank" rel="noopener noreferrer"
                  className="text-blue-600 font-bold hover:underline flex items-center"
                >
                  <ExternalLink size={9} className="mr-0.5" />Compress Files Free
                </a>
              </div>
              <div className="text-[9px] text-slate-500 font-mono font-bold">
                {stats.done}/{stats.totalRequired} Required Done | {stats.skipped} Skipped
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════
          PREVIEW MODAL
          ═══════════════════════════════════ */}
      {previewModal.open && previewModal.files.length > 0 && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4"
          onClick={closePreview}
        >
          <div
            className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-military-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">{previewModal.docLabel}</h3>
                <p className="text-[10px] text-military-300 mt-0.5">
                  File {previewModal.currentIndex + 1} of {previewModal.files.length} —{' '}
                  {previewModal.files[previewModal.currentIndex].fileName}
                  <span className="ml-2 font-mono">[{previewModal.files[previewModal.currentIndex].fileSize}]</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {previewModal.files[previewModal.currentIndex].fileUrl && (
                  <a
                    href={previewModal.files[previewModal.currentIndex].fileUrl}
                    target="_blank" rel="noopener noreferrer"
                    className="bg-slate-700 text-white px-3 py-1 text-[10px] font-bold uppercase hover:bg-slate-600 flex items-center transition-colors"
                  >
                    <Download size={12} className="mr-1" /> Download
                  </a>
                )}
                <button onClick={closePreview} className="bg-red-600 text-white p-1.5 hover:bg-red-700 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center p-4 relative">
              {previewModal.files.length > 1 && (
                <>
                  <button
                    onClick={prevPreview}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 hover:bg-opacity-70 transition-colors z-10"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={nextPreview}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black bg-opacity-50 text-white p-2 hover:bg-opacity-70 transition-colors z-10"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {previewModal.files[previewModal.currentIndex].fileType === 'application/pdf' ? (
                <div className="w-full h-full min-h-[60vh]">
                  {previewModal.files[previewModal.currentIndex].fileUrl ? (
                    <iframe
                      src={previewModal.files[previewModal.currentIndex].fileUrl}
                      className="w-full h-full min-h-[60vh] border-0"
                      title="PDF Preview"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-500">
                      <File size={48} className="mb-2 text-red-400" />
                      <p className="text-sm font-bold">PDF Preview Available After Upload</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {previewModal.files[previewModal.currentIndex].fileName}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center">
                  {previewModal.files[previewModal.currentIndex].fileUrl ? (
                    <img
                      src={previewModal.files[previewModal.currentIndex].fileUrl}
                      alt={previewModal.files[previewModal.currentIndex].fileName}
                      className="max-w-full max-h-[65vh] object-contain shadow-lg"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-slate-500 py-12">
                      <FileImage size={48} className="mb-2 text-blue-400" />
                      <p className="text-sm font-bold">Image Preview Available After Upload</p>
                      <p className="text-[10px] text-slate-400 mt-1">
                        {previewModal.files[previewModal.currentIndex].fileName}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer - Thumbnails */}
            {previewModal.files.length > 1 && (
              <div className="bg-slate-200 border-t border-slate-300 px-4 py-2 flex items-center space-x-2 overflow-x-auto flex-shrink-0">
                <span className="text-[9px] font-bold text-slate-500 uppercase mr-2 flex-shrink-0">Files:</span>
                {previewModal.files.map((file, idx) => (
                  <button
                    key={idx}
                    onClick={() => setPreviewModal(prev => ({ ...prev, currentIndex: idx }))}
                    className={`px-3 py-1.5 text-[9px] font-bold border flex-shrink-0 transition-colors ${
                      idx === previewModal.currentIndex
                        ? 'bg-military-800 text-white border-military-800'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {file.fileType === 'application/pdf'
                      ? <File size={10} className="inline mr-1" />
                      : <FileImage size={10} className="inline mr-1" />}
                    {idx + 1}. {file.fileName.length > 20 ? file.fileName.substring(0, 20) + '...' : file.fileName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};