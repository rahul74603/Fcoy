// src/features/trainee/TraineeProfileScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import {
  Search, UserSquare, Activity, ShieldAlert, Crosshair, Save, Package,
  AlertCircle, CheckCircle2, FileText, User, Shield, Heart, Phone, Award,
  Briefcase, Edit3, X, MapPin, RefreshCw, TrendingUp, Minus,
  Users, Camera, Upload, Loader2, Layers, Hash, ChevronUp, ChevronDown,
  ArrowRightLeft, Plane, UserPlus, ClipboardCheck
} from 'lucide-react';
import {
  collection, addDoc, getDocs, query, where, doc, updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { uploadTraineePhoto, deleteFromStorage } from '../shared/storage.utils';

import { useTraineeSearch } from '../../hooks/useTraineeSearch';
import type { TraineeSearchResult } from '../../hooks/useTraineeSearch';
import { ReportButton } from '../../components/common/ReportButton';

type TraineeData = TraineeSearchResult;

const STATES_OF_INDIA = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu & Kashmir', 'Ladakh', 'Chandigarh', 'Puducherry'
];
const RELIGIONS       = ['Hindu', 'Muslim', 'Sikh', 'Christian', 'Buddhist', 'Jain', 'Other'];
const CATEGORIES      = ['General', 'OBC', 'SC', 'ST', 'EWS'];
const EDUCATION_QUALS = ['10th Pass', '12th Pass', 'Graduation', 'Post Graduation'];

// ═══════════════════════════════════════════════════════════
// QM CATALOG — Same as InventoryIssueScreen.tsx
// Ye list QM ke FIXED_TRAINING_ITEMS ke equivalent hai
// ═══════════════════════════════════════════════════════════
const QM_FIXED_ITEMS = [
  { name: 'DM Shoes',     emoji: '👞', category: 'Footwear' },
  { name: 'PT Shoes',     emoji: '👟', category: 'Footwear' },
  { name: 'Ankle Shoes',  emoji: '🥾', category: 'Footwear' },
  { name: 'PT T-Shirt',   emoji: '👕', category: 'Uniform'  },
  { name: 'Ground Sheet', emoji: '🛏️', category: 'Bedding'  },
  { name: 'Plate',        emoji: '🍽️', category: 'Mess Item'},
  { name: 'Glass',        emoji: '🥤', category: 'Mess Item'},
  { name: 'Bucket',       emoji: '🪣', category: 'Equipment'},
  { name: 'Mug',          emoji: '☕', category: 'Mess Item'},
  { name: 'Mess Tin',     emoji: '🥫', category: 'Mess Item'},
  { name: 'Mosquito Net', emoji: '🦟', category: 'Bedding'  },
  { name: 'Water Bottle', emoji: '💧', category: 'Equipment'},
  { name: 'Towel',        emoji: '🧻', category: 'Equipment'},
  { name: 'Lock',         emoji: '🔒', category: 'Equipment'},
];

// ── HELPERS ──
const normalizeName = (v: string) =>
  (v || '').trim().toLowerCase().replace(/\s+/g, ' ');


// T-162: Grade calculation engine
const calcGrade = (pct: number): string => {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B+';
  if (pct >= 60) return 'B';
  if (pct >= 50) return 'C';
  if (pct >= 40) return 'D';
  return 'F';
};
const gradeColor = (grade: string): string => {
  if (grade === 'A+') return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  if (grade === 'A') return 'bg-green-100 text-green-800 border-green-300';
  if (grade === 'B+') return 'bg-blue-100 text-blue-800 border-blue-300';
  if (grade === 'B') return 'bg-cyan-100 text-cyan-800 border-cyan-300';
  if (grade === 'C') return 'bg-amber-100 text-amber-800 border-amber-300';
  if (grade === 'D') return 'bg-orange-100 text-orange-800 border-orange-300';
  return 'bg-red-100 text-red-800 border-red-300';
};
const isAssetLike = (category?: string, name?: string) => {
  const c = (category || '').toLowerCase();
  const n = (name     || '').toLowerCase();
  return c.includes('asset') || n.includes('asset');
};

// ═══════════════════════════════════════════════════════════
// IMAGE COMPRESS UTILITY
// ═══════════════════════════════════════════════════════════
const compressImageToBase64 = (
  file: File, maxW = 350, maxH = 450, quality = 0.72
): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width: w, height: h } = img;
        if (w > maxW) { h = Math.round((h * maxW) / w); w = maxW; }
        if (h > maxH) { w = Math.round((w * maxH) / h); h = maxH; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas error')); return; }
        ctx.fillStyle = '#FFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        let b64 = canvas.toDataURL('image/jpeg', quality);
        const sizeKB = Math.round((b64.length * 3) / 4 / 1024);
        if (sizeKB > 800) b64 = canvas.toDataURL('image/jpeg', 0.5);
        resolve(b64);
      };
      img.onerror = () => reject(new Error('Image load failed'));
    };
    reader.onerror = () => reject(new Error('File read failed'));
  });

// ═══════════════════════════════════════════════════════════
// PHOTO UPLOAD COMPONENT
// ═══════════════════════════════════════════════════════════
interface PhotoUploadProps {
  traineeId: string;
  traineeName: string;
  traineeRegNo?: string;
  traineeChestNo?: string;
  currentPhotoURL?: string;
  currentPhotoPath?: string;
  onUploadComplete: (url: string, path: string) => void;
  onDeleteComplete: () => void;
  compact?: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  traineeId, traineeName, traineeRegNo, traineeChestNo, currentPhotoURL,
  onUploadComplete, onDeleteComplete, compact = false,
}) => {
  const fileInputRef              = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState('');
  const [preview,   setPreview]   = useState<string | null>(currentPhotoURL || null);

  useEffect(() => { setPreview(currentPhotoURL || null); }, [currentPhotoURL]);

  const validateFile = (file: File): string | null => {
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) return 'Sirf JPG, PNG ya WEBP allowed hai';
    if (file.size > 15 * 1024 * 1024) return 'File 15MB se badi hai';
    return null;
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setSuccess('');
    const validErr = validateFile(file);
    if (validErr) { setError(validErr); return; }
    setUploading(true); setProgress(10);
    try {
      const localURL = URL.createObjectURL(file);
      setPreview(localURL); setProgress(30);

      // Upload to Firebase Storage (NOT base64 in Firestore)
      // Use regNo or chestNo for readable folder name
      const folderName = traineeRegNo || traineeChestNo || traineeId;
      const result = await uploadTraineePhoto(file, folderName);
      setProgress(80);

      // Save download URL to Firestore
      await updateDoc(doc(db, 'trainees', traineeId), {
        photoURL: result.downloadUrl,
        photoPath: result.storagePath,
        updatedAt: new Date().toISOString(),
      });
      setProgress(100); setPreview(result.downloadUrl);
      onUploadComplete(result.downloadUrl, result.storagePath);
      setSuccess('Photo saved!');
      setTimeout(() => { setSuccess(''); setProgress(0); }, 2000);
    } catch (err: any) {
      setError(`Error: ${err.message}`);
      setPreview(currentPhotoURL || null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!preview || !window.confirm('Photo delete karna hai?')) return;
    setDeleting(true); setError('');
    try {
      // Delete from Storage if we have a path
      if (currentPhotoPath && !currentPhotoPath.startsWith('base64_')) {
        try { await deleteFromStorage(currentPhotoPath); } catch { /* ignore */ }
      }
      await updateDoc(doc(db, 'trainees', traineeId), {
        photoURL: '', photoPath: '', updatedAt: new Date().toISOString(),
      });
      setPreview(null); onDeleteComplete();
    } catch (err: any) { setError(`Delete failed: ${err.message}`); }
    finally { setDeleting(false); }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="relative w-12 h-14 border-2 border-white/30 bg-slate-700 overflow-hidden flex items-center justify-center cursor-pointer group flex-shrink-0"
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          {preview
            ? <img src={preview} alt={traineeName} className="w-full h-full object-cover object-top" />
            : <Camera size={18} className="text-slate-400" />}
          {!uploading && (
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={12} className="text-white" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-0.5">
              <Loader2 size={12} className="text-white animate-spin" />
              <span className="text-[7px] text-white font-bold">{progress}%</span>
            </div>
          )}
          {preview && !uploading && (
            <button onClick={e => { e.stopPropagation(); handleDelete(); }}
              className="absolute top-0 right-0 w-4 h-4 bg-red-500 flex items-center justify-center">
              <X size={8} className="text-white" />
            </button>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || deleting}
            className="text-[9px] font-bold text-white/80 hover:text-white uppercase flex items-center gap-1 disabled:opacity-40">
            <Upload size={9} />
            {uploading ? `${progress}%` : preview ? 'Change' : 'Upload'}
          </button>
          {uploading && (
            <div className="w-20 bg-slate-600 h-1 rounded-full overflow-hidden">
              <div className="bg-green-400 h-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
          {success && <p className="text-[8px] text-green-400 font-bold">{success}</p>}
          {error   && <p className="text-[8px] text-red-400">{error}</p>}
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
          className="hidden" onChange={handleFileSelect} disabled={uploading} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div
        className="relative group w-24 h-28 border-2 border-white/30 bg-slate-700 overflow-hidden flex items-center justify-center cursor-pointer"
        onClick={() => !uploading && !deleting && fileInputRef.current?.click()}
      >
        {preview
          ? <img src={preview} alt={traineeName} className="w-full h-full object-cover object-top" />
          : <div className="flex flex-col items-center text-slate-400 pointer-events-none">
              <Camera size={28} />
              <p className="text-[8px] font-bold mt-1 uppercase">No Photo</p>
            </div>}
        {!uploading && !deleting && (
          <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center">
            <Camera size={18} className="text-white mb-1" />
            <p className="text-[9px] text-white font-bold uppercase">{preview ? 'Change' : 'Upload'}</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center gap-2">
            <Loader2 size={20} className="text-white animate-spin" />
            <div className="w-16 bg-slate-600 h-1.5 rounded-full overflow-hidden">
              <div className="bg-green-400 h-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-[9px] text-white font-bold">{progress}%</span>
          </div>
        )}
        {preview && !uploading && (
          <button onClick={e => { e.stopPropagation(); handleDelete(); }} disabled={deleting}
            className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center hover:bg-red-600 shadow-md">
            {deleting
              ? <Loader2 size={10} className="animate-spin text-white" />
              : <X size={10} className="text-white" />}
          </button>
        )}
      </div>
      <button onClick={() => fileInputRef.current?.click()} disabled={uploading || deleting}
        className="flex items-center gap-1 text-[9px] font-black uppercase text-white/70 hover:text-white disabled:opacity-40">
        <Upload size={10} />
        {uploading ? `${progress}%` : preview ? 'Change' : 'Upload Photo'}
      </button>
      <p className="text-[8px] text-white/40 text-center leading-tight">JPG · PNG · WEBP<br />Auto-compressed</p>
      {success && (
        <p className="text-[9px] text-green-400 font-bold flex items-center gap-1">
          <CheckCircle2 size={10} />{success}
        </p>
      )}
      {error && (
        <div className="bg-red-900/50 border border-red-500 rounded px-2 py-1 max-w-[100px]">
          <p className="text-[8px] text-red-300 font-bold flex items-center gap-1">
            <AlertCircle size={8} />{error}
          </p>
        </div>
      )}
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden" onChange={handleFileSelect} disabled={uploading} />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// BATCH + CHEST BADGE
// ═══════════════════════════════════════════════════════════
const BatchChestBadge: React.FC<{
  batchNumber?: string; chestNo?: string; size?: 'sm' | 'md' | 'lg';
}> = ({ batchNumber, chestNo, size = 'md' }) => {
  const ts = size === 'lg' ? 'text-xs' : size === 'sm' ? 'text-[8px]' : 'text-[10px]';
  const is = size === 'lg' ? 11 : 9;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1 ${ts} font-black px-2 py-0.5 bg-blue-900 text-blue-200 border border-blue-600`}>
        <Layers size={is} />{batchNumber || 'NO BATCH'}
      </span>
      {chestNo ? (
        <span className={`inline-flex items-center gap-1 ${ts} font-black px-2 py-0.5 bg-yellow-500 text-black`}>
          <Hash size={is} />{chestNo}
        </span>
      ) : (
        <span className={`inline-flex items-center gap-1 ${ts} font-bold px-2 py-0.5 bg-amber-600 text-white`}>
          <Hash size={is} />CHEST PENDING
        </span>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// QM CATALOG ITEM TYPE
// ═══════════════════════════════════════════════════════════
interface QMCatalogItem {
  name: string;
  emoji: string;
  category: string;
  isCustom?: boolean;
}

// ═══════════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════════
export const TraineeProfileScreen = () => {

  const {
    trainee:    searchedTrainee,
    traineeId:  searchedTraineeId,
    loading:    searchLoading,
    error:      searchError,
    activeBatch,
    allBatches,
    hasBatch,
    searchTrainee,
    setTrainee:   setSearchedTrainee,
  } = useTraineeSearch();

  const [searchQuery, setSearchQuery] = useState('');
  const [showAllTrainees, setShowAllTrainees] = useState(false);
  const [allTraineesList, setAllTraineesList] = useState<any[]>([]);
  const [traineesListLoading, setTraineesListLoading] = useState(false);
  const [traineeFilter, setTraineeFilter] = useState('ALL');

  // ✅ QM Catalog — combined fixed + custom items
  const [qmCatalog,        setQmCatalog]        = useState<QMCatalogItem[]>([]);
  const [qmCatalogLoading, setQmCatalogLoading] = useState(false);

  const [showRegistrationForm, setShowRegistrationForm] = useState(false);
  const [showEditModal,        setShowEditModal]         = useState(false);
  const [currentStep,          setCurrentStep]           = useState(1);
  const [formLoading,          setFormLoading]           = useState(false);
  const [formMessage,          setFormMessage]           = useState('');
  const [formSuccess,          setFormSuccess]           = useState(false);
  const [editMessage,          setEditMessage]           = useState('');
  const [editLoading,          setEditLoading]           = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState<string>('personal');

  // ── NEW: Detailed exam records ──
  const [fptRecordsList, setFptRecordsList] = useState<any[]>([]);
  const [weeklyTestsList, setWeeklyTestsList] = useState<any[]>([]);
  const [allTestsList, setAllTestsList] = useState<any[]>([]);  // ALL test types from training_tests
  const [examRecordsLoading, setExamRecordsLoading] = useState(false);
  const [expandedFptId, setExpandedFptId] = useState<string | null>(null);
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);
  const [expandedTestId2, setExpandedTestId2] = useState<string | null>(null);
  const [medicalRecordsList, setMedicalRecordsList] = useState<any[]>([]);
  const [absentRecordsList, setAbsentRecordsList] = useState<any[]>([]);
  const [periodAttendanceList, setPeriodAttendanceList] = useState<any[]>([]);

  const getEmptyForm = () => ({
    batchId: activeBatch?.id || '', batchNumber: activeBatch?.batchNumber || '',
    batchName: activeBatch?.batchName || '',
    name: '', fatherName: '', motherName: '', dob: '', age: '', gender: 'Male',
    bloodGroup: 'O+', religion: 'Hindu', category: 'General', maritalStatus: 'Unmarried',
    regNo: '', aadharNo: '', panNo: '', mobileNo: '', emergencyContact: '',
    emergencyContactName: '', relationship: '', village: '', tehsil: '', district: '',
    state: 'Rajasthan', pinCode: '', education: '12th Pass', boardUniversity: '',
    passingYear: '', percentage: '', recruitmentCenter: '', joinDate: '',
    platoon: 'Platoon 1', section: 'Section A', height: '', weight: '', chest: '',
    medStat: 'SHAPE-1', medRemarks: '', chestNo: '', remarks: '-',
    shoeSize: '', dressSize: '', weaponNo: '',
  });

  const [formData, setFormData] = useState(getEmptyForm);
  const [editData, setEditData] = useState<TraineeData>({ id: '' });

  useEffect(() => {
    if (activeBatch) {
      setFormData(prev => ({
        ...prev,
        batchId:     activeBatch.id,
        batchNumber: activeBatch.batchNumber,
        batchName:   activeBatch.batchName,
      }));
    }
  }, [activeBatch]);

  const maxDob = new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0];
  const minDob = new Date(new Date().setFullYear(new Date().getFullYear() - 30)).toISOString().split('T')[0];

  // ═══════════════════════════════════════════════════════════
  // ✅ FETCH QM CATALOG — Fixed + Custom items (same as QM screen)
  // ═══════════════════════════════════════════════════════════
  const fetchQMCatalog = async () => {
    setQmCatalogLoading(true);
    try {
      const catalogMap = new Map<string, QMCatalogItem>();

      // 1️⃣ Add fixed items first
      QM_FIXED_ITEMS.forEach(item => {
        if (isAssetLike(item.category, item.name)) return;
        catalogMap.set(normalizeName(item.name), item);
      });

      // 2️⃣ Add custom items from Firestore
      try {
        const customSnap = await getDocs(collection(db, 'training_custom_items'));
        customSnap.forEach(d => {
          const data = d.data() as any;
          const name = String(data.name ?? '').trim();
          if (!name) return;
          const category = data.category ?? 'Other';
          if (isAssetLike(category, name)) return;
          catalogMap.set(normalizeName(name), {
            name,
            emoji:    data.emoji    ?? '📦',
            category,
            isCustom: true,
          });
        });
      } catch {
        // custom collection may not exist — ignore
      }

      const list = Array.from(catalogMap.values())
        .filter(i => normalizeName(i.name) !== 'other')
        .sort((a, b) => a.name.localeCompare(b.name));

      setQmCatalog(list);
    } catch (err) {
      console.error('QM Catalog fetch error:', err);
      setQmCatalog(QM_FIXED_ITEMS);
    } finally {
      setQmCatalogLoading(false);
    }
  };

  useEffect(() => { fetchQMCatalog(); }, []);

  // ── REAL-TIME TRAINEE SYNC ──
  useEffect(() => {
    if (!searchedTraineeId) return;

    const unsub = onSnapshot(doc(db, 'trainees', searchedTraineeId), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;
      setSearchedTrainee(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          issuedKitItems:    data.issuedKitItems    ?? prev.issuedKitItems    ?? [],
          lastKitIssueDate:  data.lastKitIssueDate  ?? prev.lastKitIssueDate,
          fptResult:         data.fptResult         ?? prev.fptResult,
          fptScore:          data.fptScore          ?? prev.fptScore,
          weeklyExamResult:  data.weeklyExamResult  ?? prev.weeklyExamResult,
          weeklyExamMarks:   data.weeklyExamMarks   ?? prev.weeklyExamMarks,
          ptScore:           data.ptScore           ?? prev.ptScore,
          attn:              data.attn              ?? prev.attn,
          punishments:       data.punishments       ?? prev.punishments,
          rifleNo:           data.rifleNo           ?? prev.rifleNo,
          weaponNo:          data.weaponNo          ?? prev.weaponNo,
          medStat:           data.medStat           ?? prev.medStat,
          medRemarks:        data.medRemarks        ?? prev.medRemarks,
        };
      });
    });

    return () => unsub();
  }, [searchedTraineeId]);

  // ── Fetch ALL data when trainee selected ──
  useEffect(() => {
    if (!searchedTraineeId || !activeBatch) {
      setFptRecordsList([]); setWeeklyTestsList([]); setMedicalRecordsList([]); setAbsentRecordsList([]);
      return;
    }

    const fetchAllData = async () => {
      setExamRecordsLoading(true);
      try {
        // Try indexed queries first (needs Firestore indexes)
        const tryQuery = async (col: string) => {
          try {
            const snap = await getDocs(query(
              collection(db, col),
              where('batchId', '==', activeBatch.id),
              where('traineeId', '==', searchedTraineeId)
            ));
            const list: any[] = [];
            snap.forEach(d => list.push({ id: d.id, ...d.data() }));
            return list;
          } catch {
            // Fallback: fetch all + client filter (works without indexes)
            try {
              const allSnap = await getDocs(query(collection(db, col), where('batchId', '==', activeBatch.id)));
              const list: any[] = [];
              allSnap.forEach(d => {
                const data = d.data() as any;
                if (data.traineeId === searchedTraineeId) list.push({ id: d.id, ...data });
              });
              return list;
            } catch { return []; }
          }
        };

        const [fptList, testList, medList, absList, trainingTestsList, periodAttnList] = await Promise.all([
          tryQuery('fptRecords'),
          tryQuery('weeklyTestRecords'),
          tryQuery('medicalRecords'),
          tryQuery('absentRecords'),
          tryQuery('training_tests'),
          tryQuery('periodAttendance'),
        ]);

        // ── Extract per-trainee results from training_tests (master source) ──
        const fptFromMaster: any[] = [];
        const weeklyFromMaster: any[] = [];
        const allFromMaster: any[] = [];
        for (const test of trainingTestsList) {
          const results = Array.isArray(test.results) ? test.results : [];
          const myResult = results.find((r: any) => r.traineeId === searchedTraineeId);
          if (!myResult || myResult.status === 'absent') continue;

          const totalMarks = test.totalMarks || 100;
          const passingMarks = test.passingMarks || 40;
          const pct = totalMarks > 0 ? Math.round((myResult.marks / totalMarks) * 100) : 0;
          const entry = {
            id: test.id,
            testName: test.testName || '',
            testType: test.testType || 'custom',
            testDate: test.testDate?.toDate?.()?.toISOString?.()?.split('T')?.[0] || test.testDate || '',
            weekNumber: test.weekNumber || 0,
            obtainedMarks: myResult.marks ?? 0,
            totalMarks,
            passingMarks,
            percentage: pct,
            result: myResult.status === 'pass' ? 'Pass' : 'Fail',
            remarks: myResult.remarks || '',
            subject: test.subjectCode || test.testType || '',
            events: test.fptEvents || myResult.events || [],
            eventsPassed: myResult.eventsPassed || 0,
            eventsFailed: myResult.eventsFailed || 0,
            totalPassingMarks: passingMarks,
            // Firing Practice specific
            firingDetails: test.firingDetails || myResult.firingDetails || null,
            venue: test.venue || '',
            instructorName: test.instructorName || '',
          };

          allFromMaster.push(entry);
          if (test.testType === 'fpt') {
            fptFromMaster.push(entry);
          } else {
            weeklyFromMaster.push(entry);
          }
        }

        // ── Merge: prefer dedicated collections, fallback to training_tests ──
        const mergedFpt = fptList.length > 0 ? fptList : fptFromMaster;
        const mergedWeekly = testList.length > 0 ? testList : weeklyFromMaster;

        mergedFpt.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
        setFptRecordsList(mergedFpt);
        mergedWeekly.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
        setWeeklyTestsList(mergedWeekly);
        allFromMaster.sort((a, b) => (b.weekNumber || 0) - (a.weekNumber || 0));
        setAllTestsList(allFromMaster);
        medList.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setMedicalRecordsList(medList);
        absList.sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));
        setAbsentRecordsList(absList);
        // T-130: Period Attendance data
        periodAttnList.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        setPeriodAttendanceList(periodAttnList);
      } catch (err) {
        console.error('Data fetch error:', err);
      } finally {
        setExamRecordsLoading(false);
      }
    };

    fetchAllData();
  }, [searchedTraineeId, activeBatch]);

  // ── Age ──
  const calculateAge = (dob: string): string => {
    if (!dob) return '';
    const today = new Date(), birth = new Date(dob);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age.toString();
  };

  const handleBatchSelect = (batchId: string, isEdit = false) => {
    const selected = allBatches.find((b: any) => b.id === batchId);
    if (!selected) return;
    const batchFields = {
      batchId: selected.id, batchNumber: selected.batchNumber, batchName: selected.batchName,
    };
    if (isEdit) setEditData(prev => ({ ...prev, ...batchFields }));
    else        setFormData(prev => ({ ...prev, ...batchFields }));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    await searchTrainee(searchQuery);
  };

  // ── Fetch ALL trainees for the list view ──
  const fetchAllTrainees = async () => {
    if (!activeBatch) return;
    setTraineesListLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'trainees'), where('batchId', '==', activeBatch.id)));
      const list: any[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (a.chestNo || '').localeCompare(b.chestNo || ''));
      setAllTraineesList(list);
    } catch (err) {
      console.error('Fetch all trainees error:', err);
    } finally {
      setTraineesListLoading(false);
    }
  };

  // ── Filtered trainee list based on selected filter ──
  const filteredTraineesList = allTraineesList.filter(t => {
    if (traineeFilter === 'ALL') return true;
    if (traineeFilter === 'FPT_FAIL') return t.fptResult === 'Fail';
    if (traineeFilter === 'FPT_PASS') return t.fptResult === 'Pass';
    if (traineeFilter === 'TEST_FAIL') return t.weeklyExamResult === 'Fail';
    if (traineeFilter === 'TEST_PASS') return t.weeklyExamResult === 'Pass';
    if (traineeFilter === 'DOCS_PENDING') return !t.docsComplete;
    if (traineeFilter === 'KIT_PENDING') return !t.issuedKitItems || t.issuedKitItems.length < qmCatalog.length;
    if (traineeFilter === 'MEDICAL') return t.attn === 'S' || t.attn === 'H';
    if (traineeFilter === 'LEAVE') return t.attn === 'L';
    if (traineeFilter === 'ABSENT') return t.attn === 'A';
    return true;
  });

  useEffect(() => {
    if (searchedTrainee) {
      setEditData({ ...searchedTrainee, id: searchedTrainee.id || searchedTraineeId });
    }
  }, [searchedTrainee, searchedTraineeId]);

  const handlePhotoUploadComplete = async (url: string, path: string) => {
    setSearchedTrainee(prev => prev ? { ...prev, photoURL: url, photoPath: path } : prev);
    setEditData(prev => ({ ...prev, photoURL: url, photoPath: path }));
  };

  const handlePhotoDeleteComplete = async () => {
    setSearchedTrainee(prev => prev ? { ...prev, photoURL: '', photoPath: '' } : prev);
    setEditData(prev => ({ ...prev, photoURL: '', photoPath: '' }));
  };

  // ── Registration ──
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batchId) { setFormMessage('ERROR: Pehle ek Batch select karo!'); return; }
    setFormLoading(true); setFormMessage('');
    try {
      const q  = query(collection(db, 'trainees'), where('regNo', '==', formData.regNo));
      const qs = await getDocs(q);
      if (!qs.empty) {
        setFormMessage('ERROR: Yeh Registration Number pehle se exist karta hai!');
        setFormLoading(false); return;
      }
      await addDoc(collection(db, 'trainees'), {
        ...formData,
        kitIssued: false, issuedItems: [], issuedKitItems: [],
        attn: 'P', rank: 'RCT', photoURL: '', photoPath: '',
        createdAt: new Date().toISOString(),
      });
      if (formData.batchId) {
        try {
          const batchRef  = doc(db, 'batches', formData.batchId);
          const batchSnap = await getDocs(
            query(collection(db, 'trainees'), where('batchId', '==', formData.batchId))
          );
          await updateDoc(batchRef, { totalTrainees: batchSnap.size });
        } catch { /* ignore */ }
      }
      setFormMessage('SUCCESS: Rangroot ka registration safaltapurvak ho gaya!');
      setFormSuccess(true);
      setTimeout(() => {
        setShowRegistrationForm(false); setCurrentStep(1);
        setFormSuccess(false); setFormMessage('');
        setFormData(getEmptyForm());
      }, 3000);
    } catch (err: any) {
      setFormMessage(`ERROR: Registration fail. ${err.message}`);
    } finally { setFormLoading(false); }
  };

  // ── Save Edit ──
  const handleSaveEdit = async () => {
    const targetId = searchedTraineeId || editData.id;
    if (!targetId) { setEditMessage('ERROR: Trainee ID missing!'); return; }
    setEditLoading(true); setEditMessage('');
    try {
      const { id: _removed, ...dataToSave } = editData;
      if (dataToSave.dob) dataToSave.age = calculateAge(dataToSave.dob);

      const sanitized: Record<string, any> = {};
      Object.keys(dataToSave).forEach(key => {
        const val = (dataToSave as any)[key];
        if (val !== undefined) {
          sanitized[key] = val === null ? null : val;
        }
      });

      await updateDoc(doc(db, 'trainees', targetId), {
        ...sanitized, updatedAt: new Date().toISOString(),
      });
      const updated: TraineeData = {
        ...dataToSave, id: targetId,
        age: dataToSave.dob ? calculateAge(dataToSave.dob) : (dataToSave.age || ''),
      };
      setSearchedTrainee(updated);
      setEditData({ ...updated, id: targetId });
      setEditMessage('SUCCESS: Profile update ho gaya!');
      setTimeout(() => { setShowEditModal(false); setEditMessage(''); }, 2000);
    } catch (err: any) {
      setEditMessage(`ERROR: ${err.message}`);
    } finally { setEditLoading(false); }
  };

  // ═══════════════════════════════════════════════════════════
  // ✅ NEW KIT STATUS — QM ke issuedKitItems se sync
  // ═══════════════════════════════════════════════════════════
  interface KitStatusRow {
    name: string;
    emoji: string;
    category: string;
    isIssued: boolean;
    quantity: number;
    size: string;
    lastIssueDate: string;
    issueCount: number;
  }

  const getKitStatusV2 = (t: TraineeData) => {
    const issuedItems: any[] = (t.issuedKitItems as any[]) || [];

    // Group issued items by normalized name
    const issuedMap = new Map<string, {
      itemName: string;
      totalQty: number;
      lastDate: string;
      size: string;
      count: number;
    }>();

    issuedItems.forEach(it => {
      const itemName = String(it.itemName ?? '').trim();
      if (!itemName) return;
      const key = normalizeName(itemName);
      if (!issuedMap.has(key)) {
        issuedMap.set(key, {
          itemName,
          totalQty: 0,
          lastDate: '',
          size:     '',
          count:    0,
        });
      }
      const agg = issuedMap.get(key)!;
      agg.totalQty += Number(it.quantity ?? 1);
      agg.count    += 1;
      if (it.issueDate && (!agg.lastDate || it.issueDate > agg.lastDate)) {
        agg.lastDate = it.issueDate;
      }
      if (it.assignedSize && it.assignedSize !== 'N/A' && !agg.size) {
        agg.size = it.assignedSize;
      }
    });

    // Build catalog rows + check status
    const catalogRows: KitStatusRow[] = qmCatalog.map(cat => {
      const key = normalizeName(cat.name);
      const iss = issuedMap.get(key);
      return {
        name:          cat.name,
        emoji:         cat.emoji,
        category:      cat.category,
        isIssued:      !!iss,
        quantity:      iss?.totalQty   ?? 0,
        size:          iss?.size       ?? '',
        lastIssueDate: iss?.lastDate   ?? '',
        issueCount:    iss?.count      ?? 0,
      };
    });

    // Find issued items that are NOT in catalog
    const catalogKeys = new Set(qmCatalog.map(c => normalizeName(c.name)));
    const extraIssued: KitStatusRow[] = [];
    issuedMap.forEach((val, key) => {
      if (!catalogKeys.has(key)) {
        extraIssued.push({
          name:          val.itemName,
          emoji:         '📦',
          category:      'Other',
          isIssued:      true,
          quantity:      val.totalQty,
          size:          val.size,
          lastIssueDate: val.lastDate,
          issueCount:    val.count,
        });
      }
    });

    const issued  = catalogRows.filter(r => r.isIssued).concat(extraIssued);
    const pending = catalogRows.filter(r => !r.isIssued);

    return { issued, pending, total: catalogRows.length + extraIssued.length };
  };

  const getDocStatus = (t: TraineeData) => {
    if (!t.documents) return { required: 0, done: 0, pending: [] as string[] };
    const entries  = Object.entries(t.documents);
    const required = entries.filter(([, v]: any) => v?.isRequired);
    const done     = required.filter(([, v]: any) => v?.status === 'Uploaded' || v?.status === 'Verified');
    const pending  = required.filter(([, v]: any) => v?.status === 'Pending'  || v?.status === 'Rejected');
    return {
      required: required.length, done: done.length,
      pending: pending.map(([k]: any) => k.replace(/([A-Z])/g, ' $1').trim()) as string[],
    };
  };

  const formatDate = (iso: string) =>
    iso ? new Date(iso).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    }) : '—';

  const inputCls  = "w-full mt-1 text-xs px-2 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 bg-white transition-colors";
  const labelCls  = "text-[10px] font-bold text-slate-500 uppercase tracking-wider";
  const selectCls = "w-full mt-1 text-xs px-2 py-1.5 border border-slate-300 focus:outline-none focus:border-military-700 bg-white";

  const steps = [
    { id: 1, title: 'Batch+Personal', icon: User   },
    { id: 2, title: 'Contact',        icon: Phone  },
    { id: 3, title: 'Education',      icon: Award  },
    { id: 4, title: 'Recruitment',    icon: Shield },
    { id: 5, title: 'Medical',        icon: Heart  },
  ];

  // ════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════
  return (
    <div className="w-full flex flex-col space-y-4">

      {/* Active Batch Banner */}
      {activeBatch ? (
        <div className="bg-green-900 border border-green-600 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-black text-green-300 uppercase">Active Batch:</span>
            <span className="text-xs font-black text-white">{activeBatch.batchNumber}</span>
            <span className="text-[10px] text-green-400">{activeBatch.batchName}</span>
          </div>
          <span className="text-[9px] text-green-400 font-bold">Naye trainees is batch mein add honge</span>
        </div>
      ) : (
        <div className="bg-red-900 border border-red-600 px-4 py-2 flex items-center gap-3">
          <AlertCircle size={14} className="text-red-300 flex-shrink-0" />
          <span className="text-[10px] font-black text-red-300 uppercase">
            Koi Active Batch Nahi! Pehle Batch Management mein batch activate karo.
          </span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-300 shadow-flat p-3 space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center space-x-3 w-1/2">
            <span className="text-sm font-bold uppercase text-military-900 whitespace-nowrap">Search</span>
            <div className="relative w-full">
              <input
                type="text"
                placeholder={hasBatch ? "Name / Chest No / Reg No..." : "Pehle batch select karo..."}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                disabled={!hasBatch}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 focus:outline-none focus:border-military-700 font-mono font-bold disabled:bg-slate-100 disabled:cursor-not-allowed"
              />
              <Search className="absolute left-2.5 top-2 text-slate-400" size={16} />
            </div>
            <button onClick={handleSearch} disabled={searchLoading || !hasBatch}
              className="bg-military-800 text-white px-4 py-1.5 text-xs font-bold uppercase hover:bg-military-900 disabled:opacity-50 disabled:cursor-not-allowed">
              {searchLoading ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setShowAllTrainees(!showAllTrainees); if (!showAllTrainees) fetchAllTrainees(); }}
              disabled={!hasBatch}
              className="bg-blue-700 text-white px-4 py-1.5 text-xs font-bold uppercase hover:bg-blue-800 flex items-center gap-2 disabled:opacity-50">
              <Users size={13} /> {showAllTrainees ? 'Hide List' : 'All Trainees'}
            </button>
            <button
              onClick={() => { setShowRegistrationForm(!showRegistrationForm); setCurrentStep(1); setFormMessage(''); }}
              className="bg-military-700 text-white px-4 py-1.5 text-xs font-bold uppercase hover:bg-military-800 flex items-center gap-2">
              {showRegistrationForm
                ? <><X size={13} /> Close</>
                : <><FileText size={13} /> New Rangroot Registration</>}
            </button>
          </div>
        </div>

        {/* Filter Tabs — only show when trainee list is visible */}
        {showAllTrainees && (
          <div className="flex gap-1.5 overflow-x-auto flex-wrap border-t border-slate-200 pt-3">
            {[
              { key: 'ALL', label: `All (${allTraineesList.length})`, color: 'bg-military-700' },
              { key: 'FPT_FAIL', label: 'FPT Fail', color: 'bg-red-600' },
              { key: 'FPT_PASS', label: 'FPT Pass', color: 'bg-green-600' },
              { key: 'TEST_FAIL', label: 'Test Fail', color: 'bg-orange-600' },
              { key: 'TEST_PASS', label: 'Test Pass', color: 'bg-emerald-600' },
              { key: 'DOCS_PENDING', label: 'Docs Incomplete', color: 'bg-amber-600' },
              { key: 'KIT_PENDING', label: 'Kit Not Issued', color: 'bg-purple-600' },
              { key: 'MEDICAL', label: 'Medical/Sick', color: 'bg-red-500' },
              { key: 'LEAVE', label: 'On Leave', color: 'bg-blue-600' },
              { key: 'ABSENT', label: 'Absent', color: 'bg-slate-600' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setTraineeFilter(tab.key)}
                className={`px-2.5 py-1.5 text-[9px] font-black uppercase rounded-lg whitespace-nowrap transition-all ${traineeFilter === tab.key ? `${tab.color} text-white shadow-md` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* All Trainees List */}
      {showAllTrainees && (
        <div className="bg-white border border-slate-300 shadow-flat">
          <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-600 uppercase">
              {filteredTraineesList.length} trainees shown
            </span>
            <span className="text-[9px] text-slate-400">Click any row to view full profile</span>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            {traineesListLoading ? (
              <div className="p-8 text-center"><Loader2 size={20} className="animate-spin text-military-600 mx-auto" /></div>
            ) : filteredTraineesList.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">No trainees found</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900 text-white z-10">
                  <tr>
                    {['#', 'Chest', 'Name', 'Platoon', 'Status', 'FPT', 'Tests', 'Docs', 'Kit'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left text-[9px] font-black uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredTraineesList.map((t, idx) => {
                    const attnCode = t.attn || 'P';
                    const attnCls = attnCode === 'P' ? 'bg-green-100 text-green-700'
                      : attnCode === 'A' ? 'bg-red-100 text-red-700'
                      : attnCode === 'S' ? 'bg-orange-100 text-orange-700'
                      : attnCode === 'H' ? 'bg-purple-100 text-purple-700'
                      : attnCode === 'L' ? 'bg-blue-100 text-blue-700'
                      : attnCode === 'R' ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-teal-100 text-teal-700';
                    return (
                      <tr key={t.id} className="hover:bg-blue-50 cursor-pointer transition-colors"
                        onClick={() => { setSearchQuery(t.chestNo || t.regNo || t.name); searchTrainee(t.chestNo || t.regNo || t.name); setShowAllTrainees(false); }}>
                        <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-2"><span className="font-mono font-black text-military-800 bg-military-50 border border-military-100 px-2 py-0.5 rounded">{t.chestNo || '—'}</span></td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{t.name}</td>
                        <td className="px-3 py-2 text-slate-500">{t.platoon || '—'}</td>
                        <td className="px-3 py-2"><span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${attnCls}`}>{attnCode}</span></td>
                        <td className="px-3 py-2">{t.fptResult === 'Pass' ? <span className="text-green-600">✅</span> : t.fptResult === 'Fail' ? <span className="text-red-600">❌</span> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">{t.weeklyExamResult === 'Pass' ? <span className="text-green-600">✅</span> : t.weeklyExamResult === 'Fail' ? <span className="text-red-600">❌</span> : <span className="text-slate-300">—</span>}</td>
                        <td className="px-3 py-2">{t.docsComplete ? <CheckCircle2 size={13} className="text-green-500" /> : <AlertCircle size={13} className="text-amber-400" />}</td>
                        <td className="px-3 py-2">{(t.issuedKitItems?.length ?? 0) >= qmCatalog.length ? <CheckCircle2 size={13} className="text-green-500" /> : <span className="text-red-500 text-[9px]">{t.issuedKitItems?.length ?? 0}/{qmCatalog.length}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* REGISTRATION FORM */}
      {showRegistrationForm && (
        <div className="bg-white border border-slate-300">
          <div className="bg-military-900 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center">
              <Shield size={20} className="text-white mr-3" />
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-widest">Border Security Force</h2>
                <p className="text-[10px] text-military-300 uppercase">New Rangroot Registration</p>
              </div>
            </div>
          </div>

          {!activeBatch && (
            <div className="bg-red-50 border-b border-red-300 px-4 py-2 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-600 flex-shrink-0" />
              <p className="text-[10px] text-red-700 font-bold">
                Koi active batch nahi hai! Pehle Batch Management mein batch create karo.
              </p>
            </div>
          )}

          <div className="flex border-b border-slate-200">
            {steps.map(step => {
              const Icon = step.icon;
              return (
                <button key={step.id} onClick={() => setCurrentStep(step.id)}
                  className={`flex-1 flex flex-col items-center py-2.5 text-[9px] font-bold uppercase tracking-wider border-b-2 ${
                    currentStep === step.id
                      ? 'border-military-700 text-military-900 bg-military-50'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}>
                  <Icon size={14} className="mb-0.5" />{step.id}. {step.title}
                </button>
              );
            })}
          </div>

          <form onSubmit={handleRegistration}>
            <div className="p-4">
              {formMessage && (
                <div className={`p-3 mb-4 text-xs font-bold border flex items-center gap-2 ${
                  formMessage.includes('ERROR')
                    ? 'bg-red-50 text-red-600 border-red-200'
                    : 'bg-green-50 text-green-700 border-green-200'
                }`}>
                  {formMessage.includes('ERROR') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {formMessage}
                </div>
              )}

              {/* STEP 1 */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div className="bg-blue-50 border-2 border-blue-300 rounded p-4">
                    <h3 className="text-xs font-black text-blue-900 uppercase flex items-center gap-2 mb-3">
                      <Layers size={14} /> Batch Assignment (Required)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-blue-700 uppercase block mb-1">Select Batch *</label>
                        <select required value={formData.batchId} onChange={e => handleBatchSelect(e.target.value)}
                          className="w-full text-xs px-2 py-2 border-2 border-blue-300 focus:outline-none focus:border-blue-600 bg-white font-bold">
                          <option value="">-- Batch Select Karo --</option>
                          {allBatches.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.batchNumber} — {b.batchName}
                              {b.status === 'active' ? ' ★ ACTIVE' : ` (${b.status})`}
                            </option>
                          ))}
                        </select>
                        {formData.batchId && (
                          <p className="text-[9px] text-blue-600 font-bold mt-1 flex items-center gap-1">
                            <CheckCircle2 size={9} /> Selected: {formData.batchNumber}
                          </p>
                        )}
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-amber-600 uppercase block mb-1">Chest Number (Optional)</label>
                        <input type="text" value={formData.chestNo}
                          onChange={e => setFormData(p => ({ ...p, chestNo: e.target.value }))}
                          className="w-full text-xs px-2 py-2 border-2 border-amber-300 font-mono font-bold focus:outline-none bg-white"
                          placeholder="Training mein issue hoga" />
                        <p className="text-[9px] text-amber-500 mt-0.5">Baad mein Edit se bhi de sakte ho</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3">
                      <User size={13} /> Personal Details
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <label className={labelCls}>Full Name *</label>
                        <input required type="text" value={formData.name}
                          onChange={e => setFormData(p => ({ ...p, name: e.target.value.toUpperCase() }))}
                          className={inputCls} placeholder="RAHUL KUMAR SHARMA" />
                      </div>
                      <div>
                        <label className={labelCls}>Gender *</label>
                        <select value={formData.gender} onChange={e => setFormData(p => ({ ...p, gender: e.target.value }))} className={selectCls}>
                          <option>Male</option><option>Female</option>
                        </select>
                      </div>
                      <div><label className={labelCls}>Father's Name *</label><input required type="text" value={formData.fatherName} onChange={e => setFormData(p => ({ ...p, fatherName: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Mother's Name *</label><input required type="text" value={formData.motherName} onChange={e => setFormData(p => ({ ...p, motherName: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                      <div>
                        <label className={labelCls}>Marital Status</label>
                        <select value={formData.maritalStatus} onChange={e => setFormData(p => ({ ...p, maritalStatus: e.target.value }))} className={selectCls}>
                          {['Unmarried','Married','Divorced','Widower'].map(m => <option key={m}>{m}</option>)}
                        </select>
                      </div>
                      <div><label className={labelCls}>Date of Birth *</label><input required type="date" min={minDob} max={maxDob} value={formData.dob} onChange={e => setFormData(p => ({ ...p, dob: e.target.value, age: calculateAge(e.target.value) }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Age (Auto)</label><input readOnly value={formData.age ? `${formData.age} Years` : ''} className={`${inputCls} bg-slate-100 font-bold`} placeholder="DOB select karo" /></div>
                      <div>
                        <label className={labelCls}>Blood Group *</label>
                        <select value={formData.bloodGroup} onChange={e => setFormData(p => ({ ...p, bloodGroup: e.target.value }))} className={selectCls}>
                          {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div><label className={labelCls}>Religion</label><select value={formData.religion} onChange={e => setFormData(p => ({ ...p, religion: e.target.value }))} className={selectCls}>{RELIGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
                      <div><label className={labelCls}>Category</label><select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} className={selectCls}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
                      <div><label className={labelCls}>Aadhar Number *</label><input required type="text" maxLength={12} value={formData.aadharNo} onChange={e => setFormData(p => ({ ...p, aadharNo: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} placeholder="12 digit" /></div>
                      <div><label className={labelCls}>PAN Number</label><input type="text" maxLength={10} value={formData.panNo} onChange={e => setFormData(p => ({ ...p, panNo: e.target.value.toUpperCase() }))} className={`${inputCls} font-mono`} /></div>
                      <div><label className={labelCls}>Registration Number *</label><input required type="text" value={formData.regNo} onChange={e => setFormData(p => ({ ...p, regNo: e.target.value }))} className={`${inputCls} font-mono font-bold`} /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2 */}
              {currentStep === 2 && (
                <div>
                  <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><Phone size={13} /> Contact & Address</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Mobile Number *</label><input required type="tel" maxLength={10} value={formData.mobileNo} onChange={e => setFormData(p => ({ ...p, mobileNo: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                    <div><label className={labelCls}>Emergency Contact Name *</label><input required type="text" value={formData.emergencyContactName} onChange={e => setFormData(p => ({ ...p, emergencyContactName: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Relationship *</label><select value={formData.relationship} onChange={e => setFormData(p => ({ ...p, relationship: e.target.value }))} className={selectCls}><option value="">-- Select --</option>{['Father','Mother','Wife','Brother','Sister','Other'].map(r => <option key={r}>{r}</option>)}</select></div>
                    <div><label className={labelCls}>Emergency Contact No. *</label><input required type="tel" maxLength={10} value={formData.emergencyContact} onChange={e => setFormData(p => ({ ...p, emergencyContact: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <h4 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><MapPin size={13} /> Permanent Address</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2"><label className={labelCls}>Village / Mohalla *</label><input required type="text" value={formData.village} onChange={e => setFormData(p => ({ ...p, village: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Tehsil *</label><input required type="text" value={formData.tehsil} onChange={e => setFormData(p => ({ ...p, tehsil: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>District *</label><input required type="text" value={formData.district} onChange={e => setFormData(p => ({ ...p, district: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>State *</label><select value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} className={selectCls}>{STATES_OF_INDIA.map(s => <option key={s}>{s}</option>)}</select></div>
                      <div><label className={labelCls}>PIN Code *</label><input required type="text" maxLength={6} value={formData.pinCode} onChange={e => setFormData(p => ({ ...p, pinCode: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 */}
              {currentStep === 3 && (
                <div>
                  <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><Award size={13} /> Educational Qualification</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Qualification *</label><select value={formData.education} onChange={e => setFormData(p => ({ ...p, education: e.target.value }))} className={selectCls}>{EDUCATION_QUALS.map(eq => <option key={eq}>{eq}</option>)}</select></div>
                    <div><label className={labelCls}>Board / University *</label><input required type="text" value={formData.boardUniversity} onChange={e => setFormData(p => ({ ...p, boardUniversity: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Passing Year *</label><input required type="number" min="2000" max="2025" value={formData.passingYear} onChange={e => setFormData(p => ({ ...p, passingYear: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Percentage *</label><input required type="text" value={formData.percentage} onChange={e => setFormData(p => ({ ...p, percentage: e.target.value }))} className={inputCls} placeholder="65.5%" /></div>
                  </div>
                </div>
              )}

              {/* STEP 4 */}
              {currentStep === 4 && (
                <div>
                  <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><Shield size={13} /> Recruitment & Training</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div><label className={labelCls}>Recruitment Center *</label><input required type="text" value={formData.recruitmentCenter} onChange={e => setFormData(p => ({ ...p, recruitmentCenter: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Joining Date *</label><input required type="date" value={formData.joinDate} onChange={e => setFormData(p => ({ ...p, joinDate: e.target.value }))} className={inputCls} /></div>
                    <div><label className={labelCls}>Platoon *</label><select value={formData.platoon} onChange={e => setFormData(p => ({ ...p, platoon: e.target.value }))} className={selectCls}>{['Platoon 1','Platoon 2','Platoon 3','Platoon 4'].map(pl => <option key={pl}>{pl}</option>)}</select></div>
                    <div><label className={labelCls}>Section *</label><select value={formData.section} onChange={e => setFormData(p => ({ ...p, section: e.target.value }))} className={selectCls}>{['Section A','Section B','Section C','Section D'].map(s => <option key={s}>{s}</option>)}</select></div>
                    <div><label className={labelCls}>Shoe Size</label><input type="text" value={formData.shoeSize} onChange={e => setFormData(p => ({ ...p, shoeSize: e.target.value }))} className={inputCls} placeholder="8, 9, 10" /></div>
                    <div><label className={labelCls}>Dress Size</label><input type="text" value={formData.dressSize} onChange={e => setFormData(p => ({ ...p, dressSize: e.target.value }))} className={inputCls} placeholder="S, M, L, XL" /></div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-slate-200">
                    <h4 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><Briefcase size={13} /> Physical Measurements</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div><label className={labelCls}>Height (cm) *</label><input required type="number" min="150" max="220" value={formData.height} onChange={e => setFormData(p => ({ ...p, height: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Weight (kg) *</label><input required type="number" min="40" max="120" value={formData.weight} onChange={e => setFormData(p => ({ ...p, weight: e.target.value }))} className={inputCls} /></div>
                      <div><label className={labelCls}>Chest (cm) *</label><input required type="text" value={formData.chest} onChange={e => setFormData(p => ({ ...p, chest: e.target.value }))} className={inputCls} placeholder="77/82" /></div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5 */}
              {currentStep === 5 && (
                <div>
                  <h3 className="text-xs font-black text-military-900 uppercase flex items-center gap-2 mb-3"><Heart size={13} /> Medical Details</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className={labelCls}>Medical Status *</label>
                      <select value={formData.medStat} onChange={e => setFormData(p => ({ ...p, medStat: e.target.value }))} className={selectCls}>
                        <option value="SHAPE-1">SHAPE-1 (Fully Fit)</option>
                        <option value="SHAPE-2">SHAPE-2</option>
                        <option value="Temporary Unfit">Temporary Unfit</option>
                        <option value="Permanent Unfit">Permanent Unfit</option>
                      </select>
                    </div>
                    <div className="md:col-span-2"><label className={labelCls}>Medical Remarks</label><input type="text" value={formData.medRemarks} onChange={e => setFormData(p => ({ ...p, medRemarks: e.target.value }))} className={inputCls} /></div>
                    <div className="md:col-span-3"><label className={labelCls}>Additional Remarks</label><input type="text" value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} className={inputCls} /></div>
                  </div>
                  <div className="mt-4 p-3 bg-military-50 border border-military-200">
                    <h4 className="text-[10px] font-black uppercase text-military-900 mb-2">Registration Summary</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                      <div><span className="text-slate-400">Batch:</span> <span className="font-black text-blue-700">{formData.batchNumber || '-- NOT SET --'}</span></div>
                      <div><span className="text-slate-400">Chest:</span> <span className="font-black">{formData.chestNo || 'PENDING'}</span></div>
                      <div><span className="text-slate-400">Name:</span> <span className="font-bold">{formData.name || '--'}</span></div>
                      <div><span className="text-slate-400">Reg No:</span> <span className="font-bold font-mono">{formData.regNo || '--'}</span></div>
                      <div><span className="text-slate-400">Platoon:</span> <span className="font-bold">{formData.platoon}</span></div>
                      <div><span className="text-slate-400">Blood:</span> <span className="font-bold">{formData.bloodGroup}</span></div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-4 py-3 flex justify-between items-center bg-slate-50">
              <button type="button" onClick={() => setCurrentStep(Math.max(1, currentStep - 1))} disabled={currentStep === 1}
                className="px-4 py-1.5 text-xs font-bold uppercase border border-slate-300 bg-white disabled:opacity-40">← Previous</button>
              <div className="flex gap-1">
                {steps.map(s => (
                  <div key={s.id} className={`h-2 w-6 rounded-sm ${currentStep >= s.id ? 'bg-military-700' : 'bg-slate-200'}`} />
                ))}
              </div>
              {currentStep < 5 ? (
                <button type="button" onClick={() => setCurrentStep(Math.min(5, currentStep + 1))}
                  className="px-4 py-1.5 text-xs font-bold uppercase bg-military-800 text-white hover:bg-military-900">Next →</button>
              ) : (
                <button type="submit" disabled={formLoading || formSuccess || !formData.batchId}
                  className="px-6 py-1.5 text-xs font-bold uppercase bg-green-600 text-white flex items-center gap-2 disabled:opacity-60">
                  {formLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                    : <><Save size={13} /> Register Rangroot</>}
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Search Error */}
      {searchError && (
        <div className="bg-red-50 border border-red-200 text-red-600 p-3 text-xs font-bold uppercase text-center">
          {searchError}
        </div>
      )}

      {/* TRAINEE PROFILE */}
      {searchedTrainee ? (
        <div className="flex flex-col space-y-4">

          {/* Profile Header */}
          <div className="bg-white border border-slate-300 shadow-flat">
            <div className="bg-military-900 px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <PhotoUpload
                    traineeId={searchedTraineeId}
                    traineeName={searchedTrainee.name || ''}
                    traineeRegNo={searchedTrainee.regNo}
                    traineeChestNo={searchedTrainee.chestNo}
                    currentPhotoURL={searchedTrainee.photoURL}
                    currentPhotoPath={searchedTrainee.photoPath}
                    onUploadComplete={handlePhotoUploadComplete}
                    onDeleteComplete={handlePhotoDeleteComplete}
                  />
                  <div className="pt-1 space-y-2">
                    <h2 className="text-lg font-black text-white uppercase">
                      {searchedTrainee.rank || 'RCT'} {searchedTrainee.name}
                    </h2>
                    <BatchChestBadge batchNumber={searchedTrainee.batchNumber} chestNo={searchedTrainee.chestNo} size="lg" />
                    <div className="flex items-center flex-wrap gap-1.5">
                      <span className="text-[10px] font-mono text-military-300">Reg: {searchedTrainee.regNo}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 ${searchedTrainee.medStat === 'SHAPE-1' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {searchedTrainee.medStat || 'SHAPE-1'}
                      </span>
                      <span className="bg-military-700 text-white text-[10px] font-bold px-2 py-0.5">{searchedTrainee.platoon}</span>
                      <span className="bg-military-700 text-white text-[10px] font-bold px-2 py-0.5">{searchedTrainee.bloodGroup}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => { setEditData({ ...searchedTrainee, id: searchedTrainee.id || searchedTraineeId }); setShowEditModal(true); }}
                  className="flex-shrink-0 bg-yellow-500 text-black px-3 py-1.5 text-[10px] font-bold uppercase hover:bg-yellow-400 flex items-center gap-1">
                  <Edit3 size={12} /> Edit Profile
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-6 gap-0 border-t border-military-700">
              {[
                { label: 'Batch',    value: searchedTrainee.batchNumber || '--',  hl: true  },
                { label: 'Chest',    value: searchedTrainee.chestNo || 'PENDING', hl: true  },
                { label: 'Age',      value: searchedTrainee.age ? `${searchedTrainee.age} Yrs` : '--' },
                { label: 'Category', value: searchedTrainee.category || '--'   },
                { label: 'Ht/Wt',   value: searchedTrainee.height ? `${searchedTrainee.height}/${searchedTrainee.weight}` : '--' },
                { label: 'Joining',  value: searchedTrainee.joinDate || '--'   },
              ].map((item, idx) => (
                <div key={idx} className={`px-3 py-2 border-r border-slate-200 last:border-r-0 ${item.hl ? 'bg-blue-50' : 'bg-slate-50'}`}>
                  <p className={`text-[9px] font-bold uppercase ${item.hl ? 'text-blue-500' : 'text-slate-400'}`}>{item.label}</p>
                  <p className={`text-[11px] font-black mt-0.5 ${item.hl ? 'text-blue-900' : 'text-slate-700'}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ TABBED PROFILE ═══ */}
          <div className="bg-white border border-slate-300 shadow-flat">
            {/* Tab Bar */}
            <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50">
              {[
                { id: 'personal', label: '👤 Personal', icon: User },
                { id: 'contact', label: '📞 Contact', icon: Phone },
                { id: 'education', label: '🎓 Education', icon: Award },
                { id: 'training', label: '🏋️ Training', icon: Shield },
                { id: 'weapon', label: '🔫 Weapon', icon: Crosshair },
                { id: 'tests', label: '📝 Tests/Results', icon: TrendingUp },
                { id: 'attendance', label: '📊 Attendance', icon: Users },
                { id: 'medical', label: '🏥 Medical', icon: Heart },
                { id: 'documents', label: '📄 Documents', icon: FileText },
                { id: 'kit', label: '📦 Kit', icon: Package },
                { id: 'discipline', label: '⚖️ Anushasan', icon: Shield },
                { id: 'movement', label: '🚶 Sthanantar', icon: ArrowRightLeft },
                { id: 'leave', label: '✈️ Chhutti', icon: Plane },
                { id: 'joining', label: '🚶 Bharti', icon: UserPlus },
                { id: 'clearance', label: '📋 Klirans', icon: ClipboardCheck },
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button key={tab.id} onClick={() => setActiveProfileTab(tab.id)}
                    className={`flex items-center gap-1 px-3 py-2.5 text-[10px] font-bold uppercase whitespace-nowrap border-b-2 transition-all ${
                      activeProfileTab === tab.id ? 'border-military-700 text-military-900 bg-white' : 'border-transparent text-slate-400 hover:text-slate-600'
                    }`}>
                    <Icon size={12} />{tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="p-4">

              {/* ═══ PERSONAL TAB ═══ */}
              {activeProfileTab === 'personal' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: '👤 Personal Info', fields: [['Name', searchedTrainee.name], ['Father', searchedTrainee.fatherName], ['Mother', searchedTrainee.motherName], ['DOB', searchedTrainee.dob], ['Age', searchedTrainee.age ? `${searchedTrainee.age} Yrs` : '--'], ['Gender', searchedTrainee.gender], ['Blood Group', searchedTrainee.bloodGroup], ['Religion', searchedTrainee.religion], ['Category', searchedTrainee.category], ['Marital', searchedTrainee.maritalStatus]] },
                    { title: '🔄 Lifecycle Timeline', fields: [['Status', searchedTrainee.completionStatus || 'Training'], ['Joined', searchedTrainee.joinDate || '--'], ['Batch', searchedTrainee.batchNumber || '--'], ['FPT', searchedTrainee.fptResult || 'Not Done'], ['Weekly Exam', searchedTrainee.weeklyExamResult || 'Not Given'], ['Firing', searchedTrainee.firingResult || 'Not Done'], ['Medical', searchedTrainee.medStat || 'SHAPE-1'], ['Attendance', searchedTrainee.attn === 'P' ? '✅ Present' : searchedTrainee.attn || 'P']] },
                    { title: '📊 Performance', fields: [['PT Score', searchedTrainee.ptScore || '--'], ['FPT Result', searchedTrainee.fptResult || 'Not Done'], ['FPT Score', searchedTrainee.fptScore || '--'], ['Weekly Exam', searchedTrainee.weeklyExamResult || 'Not Given'], ['Exam Marks', searchedTrainee.weeklyExamMarks || '--'], ['Punishments', searchedTrainee.punishments || '0'], ['Status', searchedTrainee.attn === 'P' ? '✅ Present' : searchedTrainee.attn === 'A' ? '🚫 Absent' : searchedTrainee.attn === 'L' ? '✈️ Leave' : searchedTrainee.attn === 'S' ? '🤒 Sick' : searchedTrainee.attn === 'H' ? '🏥 Hospital' : searchedTrainee.attn === 'R' ? '🛌 Rest' : searchedTrainee.attn || 'P'], ['Remarks', searchedTrainee.remarks || 'NIL']] },
                  ].map(section => (
                    <div key={section.title} className="border border-slate-200 rounded-xl overflow-hidden">
                      <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">{section.title}</h4></div>
                      <div className="p-3 space-y-1.5">
                        {section.fields.map(([l, v]) => (
                          <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1 last:border-0">
                            <span className="text-slate-400 font-semibold">{l}</span>
                            <span className="font-bold text-slate-700 text-right ml-2">{(v as string) || '--'}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ CONTACT TAB ═══ */}
              {activeProfileTab === 'contact' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">📞 Contact Info</h4></div>
                    <div className="p-3 space-y-1.5">
                      {[['Mobile', searchedTrainee.mobileNo], ['Emergency Contact', searchedTrainee.emergencyContact], ['Emergency Name', searchedTrainee.emergencyContactName], ['Relationship', searchedTrainee.relationship]].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">📍 Address</h4></div>
                    <div className="p-3 space-y-1.5">
                      {[['Village', searchedTrainee.village], ['Tehsil', searchedTrainee.tehsil], ['District', searchedTrainee.district], ['State', searchedTrainee.state], ['PIN Code', searchedTrainee.pinCode]].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ EDUCATION TAB ═══ */}
              {activeProfileTab === 'education' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-w-md">
                  <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">🎓 Education</h4></div>
                  <div className="p-3 space-y-1.5">
                    {[['Qualification', searchedTrainee.education], ['Board/University', searchedTrainee.boardUniversity], ['Passing Year', searchedTrainee.passingYear], ['Percentage', searchedTrainee.percentage]].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ TRAINING TAB ═══ */}
              {activeProfileTab === 'training' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">🏋️ Physical</h4></div>
                    <div className="p-3 space-y-1.5">
                      {[['Height', searchedTrainee.height ? `${searchedTrainee.height} cm` : '--'], ['Weight', searchedTrainee.weight ? `${searchedTrainee.weight} kg` : '--'], ['Chest', searchedTrainee.chest || '--'], ['Shoe Size', searchedTrainee.shoeSize || '--'], ['Dress Size', searchedTrainee.dressSize || '--']].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                      ))}
                    </div>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">🎖️ Recruitment</h4></div>
                    <div className="p-3 space-y-1.5">
                      {[['Recruitment Center', searchedTrainee.recruitmentCenter || '--'], ['Joining Date', searchedTrainee.joinDate || '--'], ['Platoon', searchedTrainee.platoon || '--'], ['Section', searchedTrainee.section || '--'], ['Batch', searchedTrainee.batchNumber || '--'], ['Chest No', searchedTrainee.chestNo || 'PENDING']].map(([l, v]) => (
                        <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ WEAPON TAB ═══ */}
              {activeProfileTab === 'weapon' && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-w-md">
                  <div className="bg-military-900 px-3 py-2"><h4 className="text-[10px] font-black text-white uppercase">🔫 Weapon & Firing</h4></div>
                  <div className="p-3 space-y-1.5">
                    {[['Weapon No', searchedTrainee.weaponNo || 'Not Issued'], ['Rifle No', searchedTrainee.rifleNo || 'Not Issued'], ['Weapon Qual', searchedTrainee.weaponQual || 'Not Done'], ['Firing Result', searchedTrainee.firingResult || 'Not Done'], ['Firing Score', searchedTrainee.firingScore || '--']].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-[10px] border-b border-slate-50 pb-1"><span className="text-slate-400 font-semibold">{l}</span><span className="font-bold text-slate-700">{(v as string) || '--'}</span></div>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ TESTS/RESULTS TAB — ALL TYPES ═══ */}
              {activeProfileTab === 'tests' && (
                <div className="space-y-4">
                  {examRecordsLoading ? <div className="p-6 text-center"><Loader2 size={20} className="animate-spin text-military-600 mx-auto" /></div>
                  : allTestsList.length === 0 ? (
                    <div className="bg-slate-50 border border-slate-200 p-6 text-center rounded-xl">
                      <Crosshair size={28} className="mx-auto text-slate-300 mb-2" />
                      <p className="text-xs font-bold text-slate-400">Abhi tak koi test record nahi</p>
                    </div>
                  ) : (
                    <>
                      {/* Summary Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                        {(() => {
                          const typeMap: Record<string, { label: string; icon: string; color: string }> = {
                            fpt: { label: 'FPT', icon: '⚡', color: 'bg-green-50 border-green-300 text-green-800' },
                            firing: { label: 'Firing', icon: '🎯', color: 'bg-orange-50 border-orange-300 text-orange-800' },
                            drill: { label: 'Drill', icon: '🎖️', color: 'bg-purple-50 border-purple-300 text-purple-800' },
                            weapon: { label: 'Weapon', icon: '🔫', color: 'bg-red-50 border-red-300 text-red-800' },
                            pt: { label: 'PT', icon: '🏋️', color: 'bg-blue-50 border-blue-300 text-blue-800' },
                            weekly: { label: 'Weekly', icon: '📅', color: 'bg-indigo-50 border-indigo-300 text-indigo-800' },
                            map_reading: { label: 'Map', icon: '🗺️', color: 'bg-cyan-50 border-cyan-300 text-cyan-800' },
                            field_craft: { label: 'Field', icon: '⛺', color: 'bg-amber-50 border-amber-300 text-amber-800' },
                            battle_craft: { label: 'Battle', icon: '⚔️', color: 'bg-pink-50 border-pink-300 text-pink-800' },
                            first_aid: { label: 'First Aid', icon: '🏥', color: 'bg-rose-50 border-rose-300 text-rose-800' },
                            custom: { label: 'Custom', icon: '📝', color: 'bg-slate-50 border-slate-300 text-slate-800' },
                          };
                          const grouped: Record<string, any[]> = {};
                          allTestsList.forEach(t => { const k = t.testType || 'custom'; (grouped[k] = grouped[k] || []).push(t); });
                          return Object.entries(grouped).map(([type, tests]) => {
                            const info = typeMap[type] || typeMap.custom;
                            const passed = tests.filter(t => t.result === 'Pass').length;
                            return (
                              <div key={type} className={`rounded-xl border-2 p-2.5 text-center ${info.color}`}>
                                <p className="text-lg">{info.icon}</p>
                                <p className="text-lg font-black">{tests.length}</p>
                                <p className="text-[8px] font-black uppercase">{info.label}</p>
                                <p className="text-[7px] opacity-60">{passed}P/{tests.length - passed}F</p>
                              </div>
                            );
                          });
                        })()}
                      </div>

                      {/* T-161: Subject-wise Marks Summary */}
                      {(() => {
                        const subjectMap: Record<string, { total: number; obtained: number; count: number; best: number; latest: number }> = {};
                        allTestsList.forEach(t => {
                          const subj = t.subject || t.testType || 'General';
                          if (!subjectMap[subj]) subjectMap[subj] = { total: 0, obtained: 0, count: 0, best: 0, latest: 0 };
                          subjectMap[subj].total += (t.totalMarks || 100);
                          subjectMap[subj].obtained += (t.obtainedMarks || 0);
                          subjectMap[subj].count++;
                          subjectMap[subj].best = Math.max(subjectMap[subj].best, t.percentage || 0);
                          subjectMap[subj].latest = t.percentage || 0;
                        });
                        if (Object.keys(subjectMap).length <= 1) return null;
                        return (
                          <div className="bg-indigo-50 border-2 border-indigo-200 rounded-xl p-4">
                            <h3 className="text-xs font-black text-indigo-900 uppercase mb-3">📊 Subject-wise Summary (T-161)</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              {Object.entries(subjectMap).map(([subj, data]) => {
                                const avgPct = data.count > 0 ? Math.round(data.obtained / data.total * 100) : 0;
                                const grade = calcGrade(avgPct);
                                return (
                                  <div key={subj} className="bg-white rounded-lg border border-indigo-200 p-2.5 text-center">
                                    <p className="text-[9px] font-black text-indigo-700 uppercase truncate">{subj}</p>
                                    <p className="text-lg font-black text-slate-800">{avgPct}%</p>
                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border ${gradeColor(grade)}`}>{grade}</span>
                                    <p className="text-[7px] text-slate-400 mt-0.5">{data.count} tests · Best: {data.best}%</p>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}

                      {/* All Tests List — grouped by type */}
                      {(() => {
                        const typeMap: Record<string, { label: string; icon: string }> = {
                          fpt: { label: 'FPT (Field Physical Test)', icon: '⚡' },
                          firing: { label: 'Firing Practice', icon: '🎯' },
                          drill: { label: 'Drill Test', icon: '🎖️' },
                          weapon: { label: 'Weapon Training', icon: '🔫' },
                          pt: { label: 'PT Test', icon: '🏋️' },
                          weekly: { label: 'Weekly Written Test', icon: '📅' },
                          map_reading: { label: 'Map Reading', icon: '🗺️' },
                          field_craft: { label: 'Field Craft', icon: '⛺' },
                          battle_craft: { label: 'Battle Craft', icon: '⚔️' },
                          first_aid: { label: 'First Aid', icon: '🏥' },
                          custom: { label: 'Custom Test', icon: '📝' },
                        };
                        const grouped: Record<string, any[]> = {};
                        allTestsList.forEach(t => { const k = t.testType || 'custom'; (grouped[k] = grouped[k] || []).push(t); });
                        return Object.entries(grouped).map(([type, tests]) => {
                          const info = typeMap[type] || typeMap.custom;
                          return (
                            <div key={type}>
                              <h3 className="text-xs font-black uppercase text-military-900 mb-2 flex items-center gap-2">
                                <span>{info.icon}</span> {info.label} — {tests.length} test(s)
                              </h3>
                              <div className="space-y-2">
                                {tests.map((r: any, idx: number) => {
                                  const rowId = String(r.id || `${type}-${idx}`);
                                  const isOpen = expandedTestId2 === rowId;
                                  const pass = r.result === 'Pass';
                                  const events = Array.isArray(r.events) ? r.events : [];
                                  const isFpt = type === 'fpt';
                                  const isFiring = type === 'firing';
                                  return (
                                    <div key={rowId} className={`rounded-xl border overflow-hidden ${pass ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                      <button type="button" onClick={() => setExpandedTestId2(isOpen ? null : rowId)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/50">
                                        <div className="flex items-center gap-3 min-w-0 flex-1">
                                          {isOpen ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                                          <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded-lg">W{r.weekNumber || '—'}</span>
                                          <div className="min-w-0">
                                            <p className="text-[11px] font-black text-slate-800 truncate">{r.testName || info.label}</p>
                                            <p className="text-[9px] text-slate-500">{r.testDate || '—'} · {r.obtainedMarks ?? 0}/{r.totalMarks ?? '—'} · {r.venue || ''}</p>
                                          </div>
                                        </div>
                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg flex-shrink-0 ${pass ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{r.percentage ?? 0}% {pass ? 'PASS' : 'FAIL'}</span>
                                      </button>
                                      {isOpen && (
                                        <div className="border-t border-white/70 bg-white px-4 py-3">
                                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                                            {[['Result', r.result || '—'], ['Obtained', `${r.obtainedMarks ?? 0}/${r.totalMarks ?? '—'}`], ['Percentage', `${r.percentage ?? 0}%`], ['Passing', r.passingMarks ?? '—'], ['Date', r.testDate || '—'], ['Venue', r.venue || '—'], ['Instructor', r.instructorName || '—'], ['Remarks', r.remarks || '—']].map(([l, v]) => (
                                              <div key={l} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5"><p className="text-[8px] font-black text-slate-400 uppercase">{l}</p><p className="text-[10px] font-bold text-slate-800 mt-0.5">{String(v)}</p></div>
                                            ))}
                                          </div>
                                          {isFpt && events.length > 0 && (
                                            <div className="space-y-1.5 mt-3">
                                              <p className="text-[9px] font-black text-slate-500 uppercase">Event-wise Performance</p>
                                              {events.map((ev: any, ei: number) => (
                                                <div key={ei} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${ev.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                                                  <div><p className="text-[10px] font-black text-slate-800">{ev.name || `Event ${ei + 1}`}</p><p className="text-[9px] text-slate-500">Pass: {ev.passingMarks ?? '—'} · Max: {ev.maxMarks ?? '—'}{ev.runningGrade ? ` · ${ev.runningGrade}` : ''}</p></div>
                                                  <span className={`text-[10px] font-black px-2 py-1 rounded-lg ${ev.passed ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{ev.marks ?? 0}/{ev.maxMarks ?? '—'} {ev.passed ? 'PASS' : 'FAIL'}</span>
                                                </div>
                                              ))}
                                              <div className="flex gap-3 mt-2">
                                                <span className="text-[9px] font-bold text-green-600">✅ {r.eventsPassed ?? 0} Passed</span>
                                                <span className="text-[9px] font-bold text-red-600">❌ {r.eventsFailed ?? 0} Failed</span>
                                              </div>
                                            </div>
                                          )}
                                          {isFiring && (
                                            <div className="mt-3 space-y-3">
                                              <p className="text-[9px] font-black text-orange-600 uppercase">🎯 BSF Firing Range Register</p>
                                              {r.firingDetails?.ringValues && r.firingDetails.ringValues.length > 0 ? (
                                                <div className="space-y-2">
                                                  {/* Ring Values — Shot by Shot */}
                                                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                                                    <p className="text-[9px] font-black text-orange-700 mb-1.5">Shot Values (प्रत्येक शॉट का रिंग वैल्यू)</p>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {r.firingDetails.ringValues.map((rv: number, i: number) => (
                                                        <span key={i} className={`text-sm font-black px-2.5 py-1 rounded-lg ${rv >= 8 ? 'bg-green-600 text-white' : rv >= 5 ? 'bg-amber-500 text-white' : rv > 0 ? 'bg-red-600 text-white' : 'bg-slate-400 text-white'}`}>{rv || 'M'}</span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                  {/* Score Summary */}
                                                  <div className="grid grid-cols-2 gap-2">
                                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-center">
                                                      <p className="text-[8px] font-black text-blue-600 uppercase">Actual Score</p>
                                                      <p className="text-lg font-black text-blue-900">{r.firingDetails.actualScore ?? 0}/{r.firingDetails.maxScore ?? '—'}</p>
                                                    </div>
                                                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-2 text-center">
                                                      <p className="text-[8px] font-black text-purple-600 uppercase">Rounds</p>
                                                      <p className="text-lg font-black text-purple-900">{r.firingDetails.totalRounds ?? r.firingDetails.ringValues.length}</p>
                                                    </div>
                                                  </div>
                                                  {/* Classification Badge */}
                                                  {r.firingDetails.classification && (
                                                    <div className={`rounded-xl p-3 text-center border-2 ${
                                                      r.firingDetails.classification.includes('Marksman') ? 'border-yellow-400 bg-yellow-50' :
                                                      r.firingDetails.classification.includes('First Class') ? 'border-green-400 bg-green-50' :
                                                      r.firingDetails.classification.includes('Sharpshooter') ? 'border-blue-400 bg-blue-50' :
                                                      'border-red-400 bg-red-50'
                                                    }`}>
                                                      <p className="text-[9px] font-black text-slate-500 uppercase">Classification (वर्गीकरण)</p>
                                                      <p className="text-xl font-black text-slate-800">{r.firingDetails.classification}</p>
                                                    </div>
                                                  )}
                                                  {/* Lane No */}
                                                  {r.firingDetails.laneNo && (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex justify-between">
                                                      <span className="text-[9px] font-bold text-slate-500">Lane / Target No</span>
                                                      <span className="text-xs font-black text-slate-800">{r.firingDetails.laneNo}</span>
                                                    </div>
                                                  )}
                                                  {/* Group Size */}
                                                  {r.firingDetails.groupSize && (
                                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 flex justify-between">
                                                      <span className="text-[9px] font-bold text-slate-500">Group Size</span>
                                                      <span className="text-xs font-black text-slate-800">{r.firingDetails.groupSize} mm</span>
                                                    </div>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                                                  <p className="text-[10px] font-bold text-orange-600">Firing details abhi enter nahi hue</p>
                                                  <p className="text-[9px] text-orange-400 mt-1">Test Records page se score enter karo — ring values, classification sab yaha dikhenge</p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </>
                  )}
                </div>
              )}

              {/* ═══ ATTENDANCE TAB ═══ */}
              {activeProfileTab === 'attendance' && (
                <div className="space-y-4">
                  {/* T-130: Period Attendance Summary */}
                  {periodAttendanceList.length > 0 && (() => {
                    const totalPeriods = periodAttendanceList.length;
                    const presentPeriods = periodAttendanceList.filter(r => r.status === 'Present' || r.present).length;
                    const absentPeriods = totalPeriods - presentPeriods;
                    const pct = totalPeriods > 0 ? Math.round((presentPeriods / totalPeriods) * 100) : 0;
                    // Subject-wise breakdown
                    const subjectMap: Record<string, { total: number; present: number }> = {};
                    periodAttendanceList.forEach(r => {
                      const subj = r.subject || r.subjectName || 'General';
                      if (!subjectMap[subj]) subjectMap[subj] = { total: 0, present: 0 };
                      subjectMap[subj].total++;
                      if (r.status === 'Present' || r.present) subjectMap[subj].present++;
                    });
                    return (
                      <>
                        <div className="bg-blue-50 border-2 border-blue-300 rounded-xl p-4">
                          <h3 className="text-xs font-black text-blue-900 uppercase mb-3 flex items-center gap-2">
                            📊 Kaksha Upasthiti (Period-wise Attendance)
                          </h3>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="bg-white rounded-lg p-3 text-center border border-blue-200">
                              <p className="text-2xl font-black text-blue-900">{totalPeriods}</p>
                              <p className="text-[8px] font-bold text-blue-600 uppercase">Total Periods</p>
                            </div>
                            <div className="bg-green-50 rounded-lg p-3 text-center border border-green-200">
                              <p className="text-2xl font-black text-green-700">{presentPeriods}</p>
                              <p className="text-[8px] font-bold text-green-600 uppercase">Present</p>
                            </div>
                            <div className="bg-red-50 rounded-lg p-3 text-center border border-red-200">
                              <p className="text-2xl font-black text-red-700">{absentPeriods}</p>
                              <p className="text-[8px] font-bold text-red-600 uppercase">Absent</p>
                            </div>
                            <div className={`rounded-lg p-3 text-center border ${pct >= 75 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                              <p className={`text-2xl font-black ${pct >= 75 ? 'text-green-700' : 'text-red-700'}`}>{pct}%</p>
                              <p className={`text-[8px] font-bold uppercase ${pct >= 75 ? 'text-green-600' : 'text-red-600'}`}>Attendance %</p>
                            </div>
                          </div>
                          {/* Subject-wise */}
                          {Object.keys(subjectMap).length > 0 && (
                            <div className="mt-3 space-y-1.5">
                              <p className="text-[9px] font-black text-blue-700 uppercase">Subject-wise Breakdown</p>
                              {Object.entries(subjectMap).map(([subj, data]) => {
                                const sPct = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
                                return (
                                  <div key={subj} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100">
                                    <span className="text-[10px] font-bold text-slate-700">{subj}</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-slate-500">{data.present}/{data.total}</span>
                                      <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${sPct >= 75 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{sPct}%</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </>
                    );
                  })()}
                  {(() => {
                    const b = {
                      absent: absentRecordsList.filter(r => r.type === 'A').reduce((s, r) => s + (r.totalDays || 1), 0),
                      leave: absentRecordsList.filter(r => r.type === 'L').reduce((s, r) => s + (r.totalDays || 1), 0),
                      sick: absentRecordsList.filter(r => r.type === 'S').reduce((s, r) => s + (r.totalDays || 1), 0),
                      hospital: absentRecordsList.filter(r => r.type === 'H').reduce((s, r) => s + (r.totalDays || 1), 0),
                      bRest: absentRecordsList.filter(r => r.type === 'R').reduce((s, r) => s + (r.totalDays || 1), 0),
                      medAppt: absentRecordsList.filter(r => r.type === 'M').reduce((s, r) => s + (r.totalDays || 1), 0),
                    };
                    return <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                        {[
                          { label: 'Absent', value: b.absent, icon: '🚫', color: 'bg-red-50 border-red-300 text-red-800' },
                          { label: 'Leave', value: b.leave, icon: '✈️', color: 'bg-amber-50 border-amber-300 text-amber-800' },
                          { label: 'Sick', value: b.sick, icon: '🤒', color: 'bg-orange-50 border-orange-300 text-orange-800' },
                          { label: 'Hospital', value: b.hospital, icon: '🏥', color: 'bg-purple-50 border-purple-300 text-purple-800' },
                          { label: 'B/C Rest', value: b.bRest, icon: '🛌', color: 'bg-blue-50 border-blue-300 text-blue-800' },
                          { label: 'Med Appt', value: b.medAppt, icon: '🩺', color: 'bg-teal-50 border-teal-300 text-teal-800' },
                        ].map(card => (
                          <div key={card.label} className={`rounded-xl border-2 p-3 text-center ${card.color}`}>
                            <p className="text-xl mb-1">{card.icon}</p>
                            <p className="text-2xl font-black">{card.value}</p>
                            <p className="text-[9px] font-bold uppercase opacity-70">{card.label}</p>
                            <p className="text-[8px] opacity-50">days</p>
                          </div>
                        ))}
                      </div>
                      {absentRecordsList.length > 0 && <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-100 px-3 py-2 border-b border-slate-200"><p className="text-[10px] font-black text-slate-600 uppercase">Full History ({absentRecordsList.length})</p></div>
                        <div className="max-h-64 overflow-y-auto"><table className="w-full text-[10px]"><thead className="bg-slate-50 sticky top-0"><tr>{['Type', 'Reason', 'From', 'To', 'Days', 'Status'].map(h => <th key={h} className="px-3 py-1.5 text-left font-black uppercase text-slate-500">{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-50">
                          {absentRecordsList.map((r: any) => { const m: Record<string, { l: string; i: string; c: string }> = { 'A': { l: 'Absent', i: '🚫', c: 'bg-red-100 text-red-700' }, 'L': { l: 'Leave', i: '✈️', c: 'bg-amber-100 text-amber-700' }, 'S': { l: 'Sick', i: '🤒', c: 'bg-orange-100 text-orange-700' }, 'H': { l: 'Hospital', i: '🏥', c: 'bg-purple-100 text-purple-700' }, 'R': { l: 'Rest', i: '🛌', c: 'bg-blue-100 text-blue-700' }, 'M': { l: 'Med', i: '🩺', c: 'bg-teal-100 text-teal-700' } }; const t = m[r.type] || { l: r.type, i: '❓', c: 'bg-slate-100 text-slate-700' }; return <tr key={r.id} className="hover:bg-slate-50"><td className="px-3 py-1.5"><span className={`text-[9px] font-black px-2 py-0.5 rounded-lg ${t.c}`}>{t.i} {t.l}</span></td><td className="px-3 py-1.5 font-bold text-slate-700 max-w-[150px] truncate">{r.reason || '—'}</td><td className="px-3 py-1.5 font-mono text-slate-500">{r.fromDate || '—'}</td><td className="px-3 py-1.5 font-mono text-slate-500">{r.toDate || '—'}</td><td className="px-3 py-1.5 font-black text-red-600">{r.totalDays || 1}d</td><td className="px-3 py-1.5"><span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{r.status || '—'}</span></td></tr>; })}
                        </tbody></table></div>
                      </div>}
                    </>;
                  })()}
                </div>
              )}

              {/* ═══ MEDICAL TAB ═══ */}
              {activeProfileTab === 'medical' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${searchedTrainee.medStat === 'SHAPE-1' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{searchedTrainee.medStat || 'SHAPE-1'}</span>
                    <span className="text-[10px] text-slate-500">{searchedTrainee.medRemarks || 'NIL'}</span>
                  </div>
                  {medicalRecordsList.length === 0 ? <div className="bg-green-50 border border-green-200 p-4 text-center rounded-xl"><p className="text-xs font-bold text-green-600">Medically Fit! ✅</p></div>
                  : medicalRecordsList.map((r: any) => (
                    <div key={r.id} className={`px-4 py-3 rounded-xl border flex items-center justify-between ${r.status === 'Active' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
                      <div><p className="text-[11px] font-bold text-slate-800">{r.category || 'Medical'}: {r.diagnosis || '—'}</p><p className="text-[9px] text-slate-500 mt-0.5">{r.date || '—'} {r.remarks ? `· ${r.remarks}` : ''}</p></div>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-lg ${r.status === 'Active' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{r.status === 'Active' ? '● Active' : '✓ Resolved'}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* ═══ DOCUMENTS TAB ═══ */}
              {activeProfileTab === 'documents' && (
                !searchedTrainee.documents ? <div className="bg-red-50 border border-red-200 p-4 text-center rounded-xl"><p className="text-xs font-bold text-red-600">No Documents Uploaded</p></div>
                : <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(searchedTrainee.documents).map(([key, val]: [string, any]) => {
                  if (!val || typeof val !== 'object') return null;
                  return <div key={key} className={`flex items-center justify-between p-2 border text-[10px] ${val.status === 'Verified' ? 'border-green-200 bg-green-50' : val.status === 'Uploaded' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <p className="font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 ${val.status === 'Verified' ? 'bg-green-600 text-white' : val.status === 'Uploaded' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'}`}>{val.status || 'Pending'}</span>
                  </div>;
                })}</div>
              )}

              {/* ═══ KIT TAB ═══ */}
              {activeProfileTab === 'kit' && (() => {
                const ks = getKitStatusV2(searchedTrainee);
                const pct = ks.total > 0 ? Math.round((ks.issued.length / ks.total) * 100) : 0;
                return <div className="space-y-3">
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all" style={{ width: `${pct}%` }} /></div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="border border-green-200 bg-green-50 rounded-xl p-3"><p className="text-[10px] font-black text-green-800 mb-2">✅ Issued ({ks.issued.length})</p><div className="space-y-1 max-h-40 overflow-y-auto">{ks.issued.map((row, i) => <div key={i} className="text-[10px] font-bold text-slate-700 flex items-center gap-1"><CheckCircle2 size={10} className="text-green-500" />{row.emoji} {row.name} {row.size && <span className="text-[8px] bg-slate-100 px-1 rounded">{row.size}</span>} <span className="text-[8px] bg-green-600 text-white px-1 rounded">×{row.quantity}</span></div>)}</div></div>
                    <div className="border border-red-200 bg-red-50 rounded-xl p-3"><p className="text-[10px] font-black text-red-800 mb-2">❌ Pending ({ks.pending.length})</p><div className="space-y-1 max-h-40 overflow-y-auto">{ks.pending.length === 0 ? <p className="text-[10px] text-green-600 font-bold">All Issued! ✅</p> : ks.pending.map((row, i) => <div key={i} className="text-[10px] font-bold text-slate-600 flex items-center gap-1"><Minus size={10} className="text-red-400" />{row.emoji} {row.name}</div>)}</div></div>
                  </div>
                </div>
              })()}

              {/* ═══ JOINING TAB ═══ */}
              {activeProfileTab === 'joining' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">Joining lifecycle yaha dikhega — Bharti Prakriya se linked</p>
                  <div className="bg-slate-50 border border-slate-200 p-4 text-center rounded-xl">
                    <UserPlus size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Joining records Bharti Prakriya se aayenge</p>
                  </div>
                </div>
              )}

              {/* ═══ CLEARANCE TAB ═══ */}
              {activeProfileTab === 'clearance' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">Clearance checklist yaha dikhega — Klirans Prabandhan se linked</p>
                  <div className="bg-slate-50 border border-slate-200 p-4 text-center rounded-xl">
                    <ClipboardCheck size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Clearance records Klirans Prabandhan se aayenge</p>
                  </div>
                </div>
              )}

              {/* ═══ LEAVE TAB ═══ */}
              {activeProfileTab === 'leave' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">Leave records yaha dikhenge — Chhutti Prabandhan se linked</p>
                  <div className="bg-slate-50 border border-slate-200 p-4 text-center rounded-xl">
                    <Plane size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Leave records Chhutti Prabandhan se aayenge</p>
                    <p className="text-[10px] text-slate-400 mt-1">Sidebar → Chhutti Prabandhan se apply karo</p>
                  </div>
                </div>
              )}

              {/* ═══ MOVEMENT TAB ═══ */}
              {activeProfileTab === 'movement' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">Movement/Transfer records yaha dikhenge — Sthanantar Register se linked</p>
                  <div className="bg-slate-50 border border-slate-200 p-4 text-center rounded-xl">
                    <ArrowRightLeft size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Movement records Sthanantar Register se aayenge</p>
                    <p className="text-[10px] text-slate-400 mt-1">Sidebar → Sthanantar Register se add karo</p>
                  </div>
                </div>
              )}

              {/* ═══ DISCIPLINE TAB ═══ */}
              {activeProfileTab === 'discipline' && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-500">Anushasan records yaha dikhenge — Discipline Register se linked</p>
                  <div className="bg-slate-50 border border-slate-200 p-4 text-center rounded-xl">
                    <Shield size={28} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-xs font-bold text-slate-400">Discipline records Anushasan Register se aayenge</p>
                    <p className="text-[10px] text-slate-400 mt-1">Sidebar → Anushasan Register se add karo</p>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      ) : (
        !searchLoading && !searchError && (
          <div className="bg-slate-50 border border-slate-200 p-8 text-center flex flex-col items-center">
            <UserSquare size={48} className="text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-500 uppercase">Search or Register New Rangroot</p>
          </div>
        )
      )}

      {/* EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">

            <div className="bg-military-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <PhotoUpload compact
                  traineeId={searchedTraineeId}
                  traineeName={editData?.name || ''}
                  traineeRegNo={editData?.regNo}
                  traineeChestNo={editData?.chestNo}
                  currentPhotoURL={editData?.photoURL}
                  currentPhotoPath={editData?.photoPath}
                  onUploadComplete={handlePhotoUploadComplete}
                  onDeleteComplete={handlePhotoDeleteComplete}
                />
                <div>
                  <h2 className="text-sm font-black text-white uppercase">Edit: {editData?.name}</h2>
                  <BatchChestBadge batchNumber={editData?.batchNumber} chestNo={editData?.chestNo} size="sm" />
                </div>
              </div>
              <button onClick={() => { setShowEditModal(false); setEditMessage(''); }} className="text-white hover:text-red-400">
                <X size={20} />
              </button>
            </div>

            {editMessage && (
              <div className={`px-4 py-2 text-xs font-bold border-b flex items-center gap-2 ${
                editMessage.includes('ERROR')
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                {editMessage.includes('ERROR') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                {editMessage}
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">

                {/* Batch & Chest */}
                <div className="md:col-span-3 bg-blue-50 border border-blue-200 rounded p-3">
                  <h4 className="text-[10px] font-black text-blue-900 uppercase flex items-center gap-1.5 mb-3">
                    <Layers size={12} /> Batch & Chest
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-blue-700 uppercase block mb-1">Batch *</label>
                      <select value={editData?.batchId || ''} onChange={e => handleBatchSelect(e.target.value, true)}
                        className="w-full text-xs px-2 py-1.5 border-2 border-blue-300 bg-white font-bold focus:outline-none">
                        <option value="">-- Select Batch --</option>
                        {allBatches.map((b: any) => (
                          <option key={b.id} value={b.id}>
                            {b.batchNumber} — {b.batchName} {b.status === 'active' ? '★' : `(${b.status})`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-amber-600 uppercase block mb-1">Chest Number</label>
                      <input type="text" value={editData?.chestNo || ''}
                        onChange={e => setEditData(p => ({ ...p, chestNo: e.target.value }))}
                        className="w-full text-xs px-2 py-1.5 border-2 border-amber-300 font-mono font-bold bg-white focus:outline-none"
                        placeholder="e.g. 001" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Reg No (Fixed)</label>
                      <input readOnly value={editData?.regNo || ''} className="w-full text-xs px-2 py-1.5 border border-slate-200 bg-slate-100 font-mono" />
                    </div>
                  </div>
                </div>

                {/* Personal */}
                <div className="md:col-span-3 pt-1 pb-1 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-military-900 uppercase flex items-center gap-1.5"><User size={12} /> Personal</h4>
                </div>
                <div><label className={labelCls}>Full Name *</label><input required type="text" value={editData?.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                <div><label className={labelCls}>Father Name</label><input type="text" value={editData?.fatherName || ''} onChange={e => setEditData(p => ({ ...p, fatherName: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                <div><label className={labelCls}>Mother Name</label><input type="text" value={editData?.motherName || ''} onChange={e => setEditData(p => ({ ...p, motherName: e.target.value.toUpperCase() }))} className={inputCls} /></div>
                <div><label className={labelCls}>DOB</label><input type="date" min={minDob} max={maxDob} value={editData?.dob || ''} onChange={e => setEditData(p => ({ ...p, dob: e.target.value, age: calculateAge(e.target.value) }))} className={inputCls} /></div>
                <div><label className={labelCls}>Age (Auto)</label><input readOnly value={editData?.age ? `${editData.age} Years` : ''} className={`${inputCls} bg-slate-100 font-bold`} /></div>
                <div><label className={labelCls}>Blood Group</label><select value={editData?.bloodGroup || 'O+'} onChange={e => setEditData(p => ({ ...p, bloodGroup: e.target.value }))} className={selectCls}>{['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}</select></div>
                <div><label className={labelCls}>Gender</label><select value={editData?.gender || 'Male'} onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))} className={selectCls}><option>Male</option><option>Female</option></select></div>
                <div><label className={labelCls}>Religion</label><select value={editData?.religion || 'Hindu'} onChange={e => setEditData(p => ({ ...p, religion: e.target.value }))} className={selectCls}>{RELIGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
                <div><label className={labelCls}>Category</label><select value={editData?.category || 'General'} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} className={selectCls}>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>

                {/* Contact */}
                <div className="md:col-span-3 pt-1 pb-1 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-military-900 uppercase flex items-center gap-1.5"><Phone size={12} /> Contact</h4>
                </div>
                <div><label className={labelCls}>Mobile</label><input type="tel" maxLength={10} value={editData?.mobileNo || ''} onChange={e => setEditData(p => ({ ...p, mobileNo: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>Emergency</label><input type="tel" maxLength={10} value={editData?.emergencyContact || ''} onChange={e => setEditData(p => ({ ...p, emergencyContact: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>District</label><input type="text" value={editData?.district || ''} onChange={e => setEditData(p => ({ ...p, district: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>State</label><select value={editData?.state || 'Rajasthan'} onChange={e => setEditData(p => ({ ...p, state: e.target.value }))} className={selectCls}>{STATES_OF_INDIA.map(s => <option key={s}>{s}</option>)}</select></div>

                {/* Training & Physical */}
                <div className="md:col-span-3 pt-1 pb-1 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-military-900 uppercase flex items-center gap-1.5"><Shield size={12} /> Training & Physical</h4>
                </div>
                <div><label className={labelCls}>Platoon</label><select value={editData?.platoon || 'Platoon 1'} onChange={e => setEditData(p => ({ ...p, platoon: e.target.value }))} className={selectCls}>{['Platoon 1','Platoon 2','Platoon 3','Platoon 4'].map(pl => <option key={pl}>{pl}</option>)}</select></div>
                <div><label className={labelCls}>Section</label><select value={editData?.section || 'Section A'} onChange={e => setEditData(p => ({ ...p, section: e.target.value }))} className={selectCls}>{['Section A','Section B','Section C','Section D'].map(s => <option key={s}>{s}</option>)}</select></div>
                <div><label className={labelCls}>Med Status</label><select value={editData?.medStat || 'SHAPE-1'} onChange={e => setEditData(p => ({ ...p, medStat: e.target.value }))} className={selectCls}>{['SHAPE-1','SHAPE-2','Temporary Unfit','Permanent Unfit'].map(m => <option key={m}>{m}</option>)}</select></div>
                <div><label className={labelCls}>Height (cm)</label><input type="number" value={editData?.height || ''} onChange={e => setEditData(p => ({ ...p, height: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Weight (kg)</label><input type="number" value={editData?.weight || ''} onChange={e => setEditData(p => ({ ...p, weight: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Chest</label><input type="text" value={editData?.chest || ''} onChange={e => setEditData(p => ({ ...p, chest: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Shoe Size</label><input type="text" value={editData?.shoeSize || ''} onChange={e => setEditData(p => ({ ...p, shoeSize: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Dress Size</label><input type="text" value={editData?.dressSize || ''} onChange={e => setEditData(p => ({ ...p, dressSize: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>Weapon No</label><input type="text" value={editData?.weaponNo || ''} onChange={e => setEditData(p => ({ ...p, weaponNo: e.target.value }))} className={`${inputCls} font-mono`} /></div>

                {/* Performance */}
                <div className="md:col-span-3 pt-1 pb-1 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-military-900 uppercase flex items-center gap-1.5"><TrendingUp size={12} /> Performance</h4>
                </div>
                <div><label className={labelCls}>FPT Result</label><select value={editData?.fptResult || ''} onChange={e => setEditData(p => ({ ...p, fptResult: e.target.value }))} className={selectCls}><option value="">Not Done</option><option value="Pass">Pass</option><option value="Fail">Fail</option></select></div>
                <div><label className={labelCls}>FPT Score</label><input type="text" value={editData?.fptScore || ''} onChange={e => setEditData(p => ({ ...p, fptScore: e.target.value }))} className={inputCls} placeholder="85/100" /></div>
                <div><label className={labelCls}>Weekly Exam</label><select value={editData?.weeklyExamResult || ''} onChange={e => setEditData(p => ({ ...p, weeklyExamResult: e.target.value }))} className={selectCls}><option value="">Not Given</option><option value="Pass">Pass</option><option value="Fail">Fail</option></select></div>
                <div><label className={labelCls}>Exam Marks</label><input type="text" value={editData?.weeklyExamMarks || ''} onChange={e => setEditData(p => ({ ...p, weeklyExamMarks: e.target.value }))} className={inputCls} placeholder="72/100" /></div>
                <div><label className={labelCls}>Punishments</label><input type="number" min="0" value={editData?.punishments || '0'} onChange={e => setEditData(p => ({ ...p, punishments: e.target.value }))} className={inputCls} /></div>
                <div>
                        <label className={labelCls}>Completion Status</label>
                        <select value={editData?.completionStatus || ''} onChange={e => setEditData(p => ({ ...p, completionStatus: e.target.value }))} className={selectCls}>
                          <option value="">-- Not Set --</option>
                          {['Joined','Training','On Leave','Medical','Under Training','Failed','Re-test','Passed','Withheld','Withdrawn','Discharged','Posted','Relieved'].map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div><label className={labelCls}>Attendance</label><select value={editData?.attn || 'P'} onChange={e => setEditData(p => ({ ...p, attn: e.target.value }))} className={selectCls}><option value="P">P — Present</option>
<option value="A">A — Absent</option>
<option value="L">L — Leave</option>
<option value="S">S — Sick / MI Room</option>
<option value="H">H — Hospital Admitted</option>
<option value="R">R — B/C Rest (Light Duty)</option>
<option value="M">M — Medical Appointment</option></select></div>
                <div className="md:col-span-3"><label className={labelCls}>Remarks</label><input type="text" value={editData?.remarks || ''} onChange={e => setEditData(p => ({ ...p, remarks: e.target.value }))} className={inputCls} /></div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 flex justify-between items-center flex-shrink-0">
              {!editData?.id && !searchedTraineeId && (
                <p className="text-[10px] text-red-600 font-bold flex items-center gap-1">
                  <AlertCircle size={12} />ID Missing!
                </p>
              )}
              <div className="flex gap-3 ml-auto">
                <button onClick={() => { setShowEditModal(false); setEditMessage(''); }}
                  className="px-5 py-2 text-xs font-bold uppercase border border-slate-300 bg-white hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleSaveEdit}
                  disabled={editLoading || (!editData?.id && !searchedTraineeId)}
                  className="bg-military-800 text-white px-6 py-2 text-xs font-bold uppercase flex items-center gap-2 disabled:opacity-60 hover:bg-military-900">
                  {editLoading
                    ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
                    : <><Save size={13} /> Save Changes</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};