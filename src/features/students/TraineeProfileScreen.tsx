// src/features/trainee/TraineeProfileScreen.tsx

import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Search, UserSquare, Activity, ShieldAlert, Crosshair, Save, Package,
  AlertCircle, CheckCircle2, FileText, User, Shield, Heart, Phone, Award,
  Briefcase, Edit3, X, MapPin, RefreshCw, TrendingUp, Minus,
  Users, Camera, Upload, Loader2, Layers, Hash
} from 'lucide-react';
import {
  collection, getDocs, query, where, doc, updateDoc,
  onSnapshot, writeBatch, increment
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { getStorage, ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';

import { useTraineeSearch } from '../../hooks/useTraineeSearch';
import type { TraineeSearchResult } from '../../hooks/useTraineeSearch';
import { ReportButton } from '../../components/common/ReportButton';
import { useAuth } from '../../contexts/AuthContext';

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
// QM CATALOG — centralized master (qmCatalog.ts), SAME list as
// InventoryIssueScreen. Duplicated hardcoded copies removed.
// ═══════════════════════════════════════════════════════════
import { QM_FIXED_ITEMS, normalizeItemName } from '../quartermaster/qmCatalog';

// ── HELPERS ──
const normalizeName = normalizeItemName;

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
  currentPhotoURL?: string;
  currentPhotoPath?: string;
  onUploadComplete: (url: string, path: string) => void;
  onDeleteComplete: () => void;
  compact?: boolean;
}

const PhotoUpload: React.FC<PhotoUploadProps> = ({
  traineeId, traineeName, currentPhotoURL, currentPhotoPath,
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
      const base64 = await compressImageToBase64(file);
      setProgress(50);

      // 📦 PREFERRED: Firebase Storage (chhota Firestore doc, tez reads).
      // Fallback: legacy base64-in-Firestore (agar Storage unreachable ho).
      // Reads backward-compatible hain — purane base64 photos <img src> me
      // waise hi chalte hain jaise Storage URLs.
      let savedURL = base64;
      let savedPath = `base64_${traineeId}`;
      try {
        const photoPath = `trainee-photos/${traineeId}/photo.jpg`;
        const photoRef = ref(getStorage(), photoPath);
        await uploadString(photoRef, base64, 'data_url');
        savedURL = await getDownloadURL(photoRef);
        savedPath = photoPath;
      } catch (storageErr) {
        console.warn('Storage photo upload failed — falling back to base64:', storageErr);
      }

      setProgress(75);
      await updateDoc(doc(db, 'trainees', traineeId), {
        photoURL: savedURL, photoPath: savedPath,
        updatedAt: new Date().toISOString(),
      });
      setProgress(100); setPreview(savedURL);
      onUploadComplete(savedURL, savedPath);
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
      // Best-effort Storage cleanup (legacy base64_ paths me koi file nahi hoti)
      if (currentPhotoPath && currentPhotoPath.startsWith('trainee-photos/')) {
        try { await deleteObject(ref(getStorage(), currentPhotoPath)); }
        catch { /* file already gone — Firestore cleanup is what matters */ }
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

  const { user } = useAuth();

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
  const [activeProfileTab,     setActiveProfileTab]      = useState<
    'overview' | 'kit' | 'docs' | 'personal' | 'exams'
  >('overview');

  const getEmptyForm = () => ({
    batchId: activeBatch?.id || '', batchNumber: activeBatch?.batchNumber || '',
    batchName: activeBatch?.batchName || '',
    // ⚠️ Sensitive personal fields (blood group, religion, category, state)
    // intentionally start EMPTY — silently prefilled values ("O+", "Hindu",
    // "General", "Rajasthan") risked saving wrong personal data unnoticed.
    name: '', fatherName: '', motherName: '', dob: '', age: '', gender: 'Male',
    bloodGroup: '', religion: '', category: '', maritalStatus: 'Unmarried',
    regNo: '', aadharNo: '', panNo: '', mobileNo: '', emergencyContact: '',
    emergencyContactName: '', relationship: '', village: '', tehsil: '', district: '',
    state: '', pinCode: '', education: '12th Pass', boardUniversity: '',
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

  // Deep-link support: /profile?search=<regNo|chestNo> (Chest Pending list,
  // Global Search etc. yahan bhejte hain) — auto-search on arrival.
  const location = useLocation();
  useEffect(() => {
    const param = new URLSearchParams(location.search).get('search');
    if (param && hasBatch) {
      setSearchQuery(param);
      searchTrainee(param);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, hasBatch]);

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

  // ── CHEST NUMBER UNIQUENESS ──
  // Chest No is intentionally OPTIONAL at registration (assigned after the
  // trainee physically arrives). But once assigned it is the operational
  // identity — the same chest number must NEVER belong to two trainees in
  // the same batch. Returns the conflicting trainee's name or null.
  const findChestConflict = async (
    chestNo: string, batchId: string, excludeTraineeId?: string
  ): Promise<string | null> => {
    const trimmed = (chestNo || '').trim();
    if (!trimmed || !batchId) return null;
    const snap = await getDocs(query(
      collection(db, 'trainees'),
      where('batchId', '==', batchId),
      where('chestNo', '==', trimmed)
    ));
    const clash = snap.docs.find(d => d.id !== excludeTraineeId);
    return clash ? String(clash.data().name ?? clash.id) : null;
  };

  // ── Registration ──
  const handleRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.batchId) { setFormMessage('ERROR: Pehle ek Batch select karo!'); return; }
    setFormLoading(true); setFormMessage('');
    try {
      const regNo = formData.regNo.trim();
      if (!regNo) {
        setFormMessage('ERROR: Registration Number required hai!');
        setFormLoading(false); return;
      }
      const q  = query(collection(db, 'trainees'), where('regNo', '==', regNo));
      const qs = await getDocs(q);
      if (!qs.empty) {
        setFormMessage('ERROR: Yeh Registration Number pehle se exist karta hai!');
        setFormLoading(false); return;
      }
      // Chest No optional — but if given at registration, must be unique in batch
      const chestNo = (formData.chestNo || '').trim();
      if (chestNo) {
        const conflict = await findChestConflict(chestNo, formData.batchId);
        if (conflict) {
          setFormMessage(`ERROR: Chest No "${chestNo}" pehle se "${conflict}" ko assigned hai!`);
          setFormLoading(false); return;
        }
      }
      // 🔐 ATOMIC — trainee create + batch counter ek saath commit.
      // (Pehle: addDoc ke baad poora collection re-read karke count update
      // hota tha — do clerks ek saath register karein to count galat ho
      // sakta tha, aur beech me fail hone par counter out-of-sync rehta tha.)
      const wb = writeBatch(db);
      wb.set(doc(collection(db, 'trainees')), {
        ...formData,
        regNo,
        chestNo,
        kitIssued: false, issuedItems: [], issuedKitItems: [],
        attn: 'P', rank: 'RCT', photoURL: '', photoPath: '',
        createdAt: new Date().toISOString(),
        // 🔍 Chest assignment audit trail (only when assigned at registration)
        ...(chestNo ? {
          chestAssignedAt: new Date().toISOString(),
          chestAssignedBy: user?.email ?? user?.name ?? 'Unknown',
        } : {}),
      });
      wb.update(doc(db, 'batches', formData.batchId), {
        totalTrainees: increment(1),
      });
      await wb.commit();
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

      // 🔒 Chest assignment control — uniqueness + audit trail.
      // Assigning (or changing) a chest number checks the whole batch so
      // two active trainees can never share an operational identity.
      const newChest = String(dataToSave.chestNo ?? '').trim();
      const oldChest = String(searchedTrainee?.chestNo ?? '').trim();
      const chestChanged = newChest !== oldChest;
      if (chestChanged && newChest) {
        const batchForCheck = String(dataToSave.batchId ?? searchedTrainee?.batchId ?? '');
        const conflict = await findChestConflict(newChest, batchForCheck, targetId);
        if (conflict) {
          setEditMessage(`ERROR: Chest No "${newChest}" pehle se "${conflict}" ko assigned hai!`);
          setEditLoading(false); return;
        }
      }

      const sanitized: Record<string, any> = {};
      Object.keys(dataToSave).forEach(key => {
        const val = (dataToSave as any)[key];
        if (val !== undefined) {
          sanitized[key] = val === null ? null : val;
        }
      });

      if (chestChanged) {
        sanitized.chestNo = newChest;
        if (newChest) {
          sanitized.chestAssignedAt = new Date().toISOString();
          sanitized.chestAssignedBy = user?.email ?? user?.name ?? 'Unknown';
        }
      }

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
      <div className="bg-white border border-slate-300 shadow-flat p-3 flex justify-between items-center">
        <div className="flex items-center space-x-3 w-1/2">
          <span className="text-sm font-bold uppercase text-military-900 whitespace-nowrap">Search</span>
          <div className="relative w-full">
            <input
              type="text"
              placeholder={hasBatch ? "Chest No / Reg No..." : "Pehle batch select karo..."}
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
        <button
          onClick={() => { setShowRegistrationForm(!showRegistrationForm); setCurrentStep(1); setFormMessage(''); }}
          className="bg-military-700 text-white px-4 py-1.5 text-xs font-bold uppercase hover:bg-military-800 flex items-center gap-2">
          {showRegistrationForm
            ? <><X size={13} /> Close</>
            : <><FileText size={13} /> New Rangroot Registration</>}
        </button>
      </div>

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
                        <select required value={formData.bloodGroup} onChange={e => setFormData(p => ({ ...p, bloodGroup: e.target.value }))} className={selectCls}>
                          <option value="">— Select —</option>
                          {['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}
                        </select>
                      </div>
                      <div><label className={labelCls}>Religion</label><select value={formData.religion} onChange={e => setFormData(p => ({ ...p, religion: e.target.value }))} className={selectCls}><option value="">— Select —</option>{RELIGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
                      <div><label className={labelCls}>Category</label><select value={formData.category} onChange={e => setFormData(p => ({ ...p, category: e.target.value }))} className={selectCls}><option value="">— Select —</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
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
                      <div><label className={labelCls}>State *</label><select required value={formData.state} onChange={e => setFormData(p => ({ ...p, state: e.target.value }))} className={selectCls}><option value="">— Select —</option>{STATES_OF_INDIA.map(s => <option key={s}>{s}</option>)}</select></div>
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

          {/* Tabs */}
          <div className="flex space-x-1 bg-slate-100 p-1 border border-slate-300">
            {[
              { id: 'overview', label: 'Overview',   icon: Activity   },
              { id: 'kit',      label: 'Kit / QM',   icon: Package    },
              { id: 'docs',     label: 'Documents',  icon: FileText   },
              { id: 'personal', label: 'Personal',   icon: User       },
              { id: 'exams',    label: 'PT / Exams', icon: TrendingUp },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveProfileTab(tab.id as any)}
                  className={`flex-1 flex items-center justify-center py-1.5 text-[10px] font-bold uppercase ${
                    activeProfileTab === tab.id ? 'bg-military-800 text-white' : 'text-slate-600 hover:bg-slate-200'
                  }`}>
                  <Icon size={12} className="mr-1" />{tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="bg-white border border-slate-300 shadow-flat">

            {/* OVERVIEW TAB */}
            {activeProfileTab === 'overview' && (
              <div className="p-4">
                <div className="bg-blue-50 border border-blue-200 p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Batch No</p><p className="text-sm font-black text-blue-900">{searchedTrainee.batchNumber || '--'}</p></div>
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Batch Name</p><p className="text-sm font-bold text-blue-800">{searchedTrainee.batchName || '--'}</p></div>
                  <div><p className="text-[9px] font-black text-amber-500 uppercase">Chest No</p><p className="text-sm font-black text-amber-900">{searchedTrainee.chestNo || 'NOT ISSUED'}</p></div>
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Reg No</p><p className="text-sm font-mono font-bold text-blue-800">{searchedTrainee.regNo || '--'}</p></div>
                </div>
                {(() => {
                  const ks = getKitStatusV2(searchedTrainee);
                  const ds = getDocStatus(searchedTrainee);
                  const issues: string[] = [];
                  if (!searchedTrainee.batchNumber) issues.push('Batch not assigned!');
                  if (!searchedTrainee.chestNo)     issues.push('Chest Number not issued');
                  if (!searchedTrainee.photoURL)    issues.push('Profile photo not uploaded');
                  if (ks.pending.length > 0)        issues.push(`${ks.pending.length} Kit items pending`);
                  if (ds.pending.length > 0)        issues.push(`${ds.pending.length} Documents pending`);
                  return issues.length > 0 ? (
                    <div className="bg-red-50 border border-red-200 p-3 mb-4">
                      <p className="text-[10px] font-black text-red-800 uppercase flex items-center mb-2">
                        <AlertCircle size={14} className="mr-2" />⚠ {issues.length} Pending
                      </p>
                      <ul className="space-y-1">
                        {issues.map((i, idx) => (
                          <li key={idx} className="text-[11px] text-red-700 font-semibold flex items-center">
                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-2" />{i}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="bg-green-50 border border-green-200 p-3 mb-4 flex items-center">
                      <CheckCircle2 size={14} className="text-green-600 mr-2" />
                      <p className="text-[11px] font-bold text-green-700 uppercase">All Clear</p>
                    </div>
                  );
                })()}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { title: 'Personal', icon: User,   fields: [['Father', searchedTrainee.fatherName], ['Mother', searchedTrainee.motherName], ['DOB', searchedTrainee.dob], ['Gender', searchedTrainee.gender], ['Religion', searchedTrainee.religion]] },
                    { title: 'Contact',  icon: Phone,  fields: [['Mobile', searchedTrainee.mobileNo], ['Emergency', searchedTrainee.emergencyContact], ['District', searchedTrainee.district], ['State', searchedTrainee.state]] },
                    { title: 'Training', icon: Shield, fields: [['Batch', searchedTrainee.batchNumber], ['Chest', searchedTrainee.chestNo || 'PENDING'], ['Platoon', searchedTrainee.platoon], ['Section', searchedTrainee.section]] },
                  ].map(s => {
                    const I = s.icon;
                    return (
                      <div key={s.title} className="border border-slate-200 p-3">
                        <h4 className="text-[10px] font-black uppercase text-military-900 border-b border-slate-200 pb-1 mb-2 flex items-center">
                          <I size={12} className="mr-1.5" />{s.title}
                        </h4>
                        <div className="space-y-1.5">
                          {s.fields.map(([l, v]) => (
                            <div key={l} className="flex justify-between text-[10px]">
                              <span className="text-slate-400 font-semibold">{l}</span>
                              <span className="font-bold text-slate-700">{(v as string) || '--'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════ */}
            {/* ✅ KIT TAB — Fully synced with QM      */}
            {/* ═══════════════════════════════════════ */}
            {activeProfileTab === 'kit' && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <BatchChestBadge batchNumber={searchedTrainee.batchNumber} chestNo={searchedTrainee.chestNo} />
                  <button onClick={fetchQMCatalog} disabled={qmCatalogLoading}
                    className="text-[10px] font-bold text-military-700 flex items-center gap-1 border border-slate-300 px-2 py-1 hover:bg-slate-50">
                    <RefreshCw size={12} className={qmCatalogLoading ? 'animate-spin' : ''} />Refresh QM
                  </button>
        <ReportButton />
                </div>

                {(() => {
                  const ks = getKitStatusV2(searchedTrainee);
                  const pct = ks.total > 0
                    ? Math.round((ks.issued.length / ks.total) * 100)
                    : 0;

                  return (
                    <>
                      {/* Summary bar */}
                      <div className="bg-slate-50 border border-slate-200 p-3 mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-black text-military-900 uppercase flex items-center">
                            <Package size={14} className="mr-2" />
                            Training Essentials — QM Sync
                          </h3>
                          <span className="text-xs font-bold text-slate-700">
                            {ks.issued.length} / {ks.total} received ({pct}%)
                          </span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 transition-all duration-500"
                            style={{ width: `${pct}%` }} />
                        </div>
                        {searchedTrainee.lastKitIssueDate && (
                          <p className="text-[9px] text-slate-500 mt-1.5">
                            Last issue: {formatDate(searchedTrainee.lastKitIssueDate)}
                          </p>
                        )}
                      </div>

                      {/* 2-Column layout: Issued | Pending */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* ── ISSUED COLUMN ── */}
                        <div className="border border-green-200 bg-green-50 rounded">
                          <div className="bg-green-100 border-b border-green-200 px-3 py-2 flex items-center justify-between">
                            <h4 className="text-[11px] font-black text-green-800 uppercase flex items-center gap-1.5">
                              <CheckCircle2 size={13} />
                              Issued ({ks.issued.length})
                            </h4>
                            <span className="text-[9px] font-bold text-green-700">From QM</span>
                          </div>
                          <div className="p-2 max-h-96 overflow-y-auto">
                            {ks.issued.length === 0 ? (
                              <p className="text-[10px] text-green-600 italic text-center py-4">
                                Abhi tak koi item issue nahi hua
                              </p>
                            ) : (
                              <div className="space-y-1.5">
                                {ks.issued.map((row, idx) => (
                                  <div key={`${row.name}_${idx}`}
                                    className="flex items-center justify-between bg-white border border-green-100 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <CheckCircle2 size={11} className="text-green-500 flex-shrink-0" />
                                      <span className="text-[11px] font-bold text-slate-700 truncate">
                                        {row.emoji} {row.name}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                      {row.size && (
                                        <span className="text-[9px] font-mono bg-slate-100 border border-slate-200 px-1 rounded">
                                          {row.size}
                                        </span>
                                      )}
                                      <span className="text-[9px] font-bold bg-green-600 text-white px-1.5 py-0.5 rounded">
                                        ×{row.quantity}
                                      </span>
                                      {row.issueCount > 1 && (
                                        <span className="text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 px-1 rounded">
                                          {row.issueCount}× issued
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* ── PENDING COLUMN ── */}
                        <div className="border border-red-200 bg-red-50 rounded">
                          <div className="bg-red-100 border-b border-red-200 px-3 py-2 flex items-center justify-between">
                            <h4 className="text-[11px] font-black text-red-800 uppercase flex items-center gap-1.5">
                              <AlertCircle size={13} />
                              Pending ({ks.pending.length})
                            </h4>
                            <span className="text-[9px] font-bold text-red-700">QM se issue karo</span>
                          </div>
                          <div className="p-2 max-h-96 overflow-y-auto">
                            {ks.pending.length === 0 ? (
                              <div className="flex flex-col items-center py-4">
                                <CheckCircle2 size={20} className="text-green-500 mb-1" />
                                <p className="text-[10px] text-green-600 font-bold uppercase">
                                  All Items Issued!
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                {ks.pending.map((row, idx) => (
                                  <div key={`${row.name}_${idx}`}
                                    className="flex items-center justify-between bg-white border border-red-100 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                      <Minus size={11} className="text-red-400 flex-shrink-0" />
                                      <span className="text-[11px] font-bold text-slate-600 truncate">
                                        {row.emoji} {row.name}
                                      </span>
                                    </div>
                                    <span className="text-[9px] font-bold text-red-600 uppercase flex-shrink-0">
                                      Pending
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Detailed Issue History (if any duplicates) */}
                      {searchedTrainee.issuedKitItems && (searchedTrainee.issuedKitItems as any[]).length > 0 && (
                        <div className="mt-4 border border-slate-200 rounded">
                          <div className="bg-slate-100 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                            <h4 className="text-[10px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                              <FileText size={12} />
                              Full Issue History ({(searchedTrainee.issuedKitItems as any[]).length} entries)
                            </h4>
                          </div>
                          <div className="max-h-48 overflow-y-auto">
                            <table className="w-full text-[10px]">
                              <thead className="bg-slate-50 sticky top-0">
                                <tr>
                                  <th className="text-left px-3 py-1.5 font-black uppercase text-slate-500">Item</th>
                                  <th className="text-center px-2 py-1.5 font-black uppercase text-slate-500">Size</th>
                                  <th className="text-center px-2 py-1.5 font-black uppercase text-slate-500">Qty</th>
                                  <th className="text-left px-3 py-1.5 font-black uppercase text-slate-500">Date</th>
                                  <th className="text-left px-3 py-1.5 font-black uppercase text-slate-500">By</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[...(searchedTrainee.issuedKitItems as any[])]
                                  .sort((a, b) =>
                                    (b.issueDate || '').localeCompare(a.issueDate || '')
                                  )
                                  .map((it, idx) => (
                                    <tr key={`${it.id}_${idx}`} className="border-t border-slate-100 hover:bg-slate-50">
                                      <td className="px-3 py-1.5 font-bold text-slate-700">{it.itemName}</td>
                                      <td className="px-2 py-1.5 text-center font-mono text-slate-500">
                                        {it.assignedSize && it.assignedSize !== 'N/A' ? it.assignedSize : '—'}
                                      </td>
                                      <td className="px-2 py-1.5 text-center font-bold text-slate-700">
                                        {it.quantity ?? 1}
                                      </td>
                                      <td className="px-3 py-1.5 text-slate-500">{formatDate(it.issueDate)}</td>
                                      <td className="px-3 py-1.5 text-slate-500 truncate max-w-[140px]">
                                        {it.issuedBy ?? '—'}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}

            {/* DOCS TAB */}
            {activeProfileTab === 'docs' && (
              <div className="p-4">
                <BatchChestBadge batchNumber={searchedTrainee.batchNumber} chestNo={searchedTrainee.chestNo} />
                <h3 className="text-xs font-black uppercase text-military-900 my-4 flex items-center">
                  <FileText size={14} className="mr-2" />Documents
                </h3>
                {!searchedTrainee.documents ? (
                  <div className="bg-red-50 border border-red-200 p-4 text-center">
                    <AlertCircle size={24} className="text-red-500 mx-auto mb-2" />
                    <p className="text-xs font-bold text-red-700">No Documents Uploaded</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(searchedTrainee.documents).map(([key, val]: [string, any]) => {
                      if (!val || typeof val !== 'object') return null;
                      return (
                        <div key={key} className={`flex items-center justify-between p-2 border text-[10px] ${
                          val.status === 'Verified' ? 'border-green-200 bg-green-50' :
                          val.status === 'Uploaded' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                        }`}>
                          <p className="font-bold text-slate-700 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 ${
                            val.status === 'Verified' ? 'bg-green-600 text-white' :
                            val.status === 'Uploaded' ? 'bg-blue-600 text-white' : 'bg-slate-300 text-slate-600'
                          }`}>{val.status || 'Pending'}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* PERSONAL TAB */}
            {activeProfileTab === 'personal' && (
              <div className="p-4">
                <div className="bg-blue-50 border border-blue-200 p-3 mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Batch</p><p className="text-sm font-black text-blue-900">{searchedTrainee.batchNumber || '--'}</p></div>
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Batch Name</p><p className="text-sm font-bold text-blue-800">{searchedTrainee.batchName || '--'}</p></div>
                  <div><p className="text-[9px] font-black text-amber-500 uppercase">Chest No</p><p className="text-sm font-black text-amber-900">{searchedTrainee.chestNo || 'NOT ISSUED'}</p></div>
                  <div><p className="text-[9px] font-black text-blue-500 uppercase">Photo</p><p className="text-sm font-bold">{searchedTrainee.photoURL ? '✓ Uploaded' : '✗ Missing'}</p></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { title: 'Personal Information', icon: User, fields: [
                      ['Name', searchedTrainee.name], ['Father', searchedTrainee.fatherName],
                      ['Mother', searchedTrainee.motherName], ['DOB', searchedTrainee.dob],
                      ['Age', searchedTrainee.age ? `${searchedTrainee.age} Yrs` : '--'],
                      ['Gender', searchedTrainee.gender], ['Blood', searchedTrainee.bloodGroup],
                      ['Religion', searchedTrainee.religion], ['Category', searchedTrainee.category],
                      ['Marital', searchedTrainee.maritalStatus],
                    ]},
                    { title: 'Identification & Batch', icon: Shield, fields: [
                      ['Batch No', searchedTrainee.batchNumber || 'NOT ASSIGNED'],
                      ['Batch Name', searchedTrainee.batchName || '--'],
                      ['Chest No', searchedTrainee.chestNo || 'NOT ISSUED'],
                      ['Reg No', searchedTrainee.regNo],
                      ['Aadhar', searchedTrainee.aadharNo ? `XXXX-${String(searchedTrainee.aadharNo).slice(-4)}` : '--'],
                      ['Weapon', searchedTrainee.weaponNo || 'Not Issued'],
                    ]},
                    { title: 'Contact', icon: Phone, fields: [
                      ['Mobile', searchedTrainee.mobileNo], ['Emergency', searchedTrainee.emergencyContact],
                      ['Em Name', searchedTrainee.emergencyContactName], ['Village', searchedTrainee.village],
                      ['District', searchedTrainee.district], ['State', searchedTrainee.state],
                      ['PIN', searchedTrainee.pinCode],
                    ]},
                    { title: 'Physical & Medical', icon: Heart, fields: [
                      ['Height', searchedTrainee.height ? `${searchedTrainee.height} cm` : '--'],
                      ['Weight', searchedTrainee.weight ? `${searchedTrainee.weight} kg` : '--'],
                      ['Chest', searchedTrainee.chest || '--'],
                      ['Shoe', searchedTrainee.shoeSize || '--'], ['Dress', searchedTrainee.dressSize || '--'],
                      ['Med Status', searchedTrainee.medStat], ['Remarks', searchedTrainee.medRemarks || 'NIL'],
                    ]},
                  ].map(section => {
                    const I = section.icon;
                    return (
                      <div key={section.title} className="border border-slate-200">
                        <div className="bg-military-900 px-3 py-2 flex items-center">
                          <I size={12} className="text-white mr-2" />
                          <h4 className="text-[10px] font-black text-white uppercase">{section.title}</h4>
                        </div>
                        <div className="p-3 space-y-1.5">
                          {section.fields.map(([l, v]) => (
                            <div key={l} className="flex justify-between text-[10px]">
                              <span className="text-slate-400 font-semibold">{l}</span>
                              <span className="font-bold text-slate-700 text-right ml-2">{(v as string) || '--'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* EXAMS TAB */}
            {activeProfileTab === 'exams' && (
              <div className="p-4">
                <BatchChestBadge batchNumber={searchedTrainee.batchNumber} chestNo={searchedTrainee.chestNo} />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  {[
                    { label: 'PT Score',    value: searchedTrainee.ptScore || '--',              icon: Activity,    color: 'border-t-military-600', sub: 'Physical Training' },
                    { label: 'FPT',         value: searchedTrainee.fptResult || 'Not Done',      icon: TrendingUp,  color: searchedTrainee.fptResult === 'Fail' ? 'border-t-red-500' : 'border-t-green-500', sub: `Score: ${searchedTrainee.fptScore || 'N/A'}` },
                    { label: 'Weekly Exam', value: searchedTrainee.weeklyExamResult || 'Not Given', icon: FileText, color: searchedTrainee.weeklyExamResult === 'Fail' ? 'border-t-red-500' : 'border-t-blue-500', sub: `Marks: ${searchedTrainee.weeklyExamMarks || 'N/A'}` },
                    { label: 'Weapon',      value: searchedTrainee.weaponQual || '--',           icon: Crosshair,   color: 'border-t-green-500', sub: 'Firing' },
                    { label: 'Punishments', value: searchedTrainee.punishments || '0',           icon: ShieldAlert, color: 'border-t-red-500',   sub: (!searchedTrainee.punishments || searchedTrainee.punishments === '0') ? 'Clean' : 'Action Required' },
                    { label: 'Attendance',  value: searchedTrainee.attn || 'P',                  icon: Users,       color: 'border-t-amber-500', sub: 'Status' },
                  ].map(card => {
                    const I = card.icon;
                    return (
                      <div key={card.label} className={`bg-white border border-slate-300 p-3 border-t-2 ${card.color}`}>
                        <div className="flex justify-between">
                          <span className="text-[10px] font-bold text-slate-500 uppercase">{card.label}</span>
                          <I size={16} className="text-slate-400" />
                        </div>
                        <p className={`text-2xl font-black mt-1 ${card.value === 'Fail' ? 'text-red-600' : 'text-military-900'}`}>
                          {card.value}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{card.sub}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
                <div><label className={labelCls}>Blood Group</label><select value={editData?.bloodGroup || ''} onChange={e => setEditData(p => ({ ...p, bloodGroup: e.target.value }))} className={selectCls}><option value="">— Select —</option>{['O+','O-','A+','A-','B+','B-','AB+','AB-'].map(b => <option key={b}>{b}</option>)}</select></div>
                <div><label className={labelCls}>Gender</label><select value={editData?.gender || 'Male'} onChange={e => setEditData(p => ({ ...p, gender: e.target.value }))} className={selectCls}><option>Male</option><option>Female</option></select></div>
                <div><label className={labelCls}>Religion</label><select value={editData?.religion || ''} onChange={e => setEditData(p => ({ ...p, religion: e.target.value }))} className={selectCls}><option value="">— Select —</option>{RELIGIONS.map(r => <option key={r}>{r}</option>)}</select></div>
                <div><label className={labelCls}>Category</label><select value={editData?.category || ''} onChange={e => setEditData(p => ({ ...p, category: e.target.value }))} className={selectCls}><option value="">— Select —</option>{CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>

                {/* Contact */}
                <div className="md:col-span-3 pt-1 pb-1 border-b border-slate-200">
                  <h4 className="text-[10px] font-black text-military-900 uppercase flex items-center gap-1.5"><Phone size={12} /> Contact</h4>
                </div>
                <div><label className={labelCls}>Mobile</label><input type="tel" maxLength={10} value={editData?.mobileNo || ''} onChange={e => setEditData(p => ({ ...p, mobileNo: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>Emergency</label><input type="tel" maxLength={10} value={editData?.emergencyContact || ''} onChange={e => setEditData(p => ({ ...p, emergencyContact: e.target.value.replace(/\D/g,'') }))} className={`${inputCls} font-mono`} /></div>
                <div><label className={labelCls}>District</label><input type="text" value={editData?.district || ''} onChange={e => setEditData(p => ({ ...p, district: e.target.value }))} className={inputCls} /></div>
                <div><label className={labelCls}>State</label><select value={editData?.state || ''} onChange={e => setEditData(p => ({ ...p, state: e.target.value }))} className={selectCls}><option value="">— Select —</option>{STATES_OF_INDIA.map(s => <option key={s}>{s}</option>)}</select></div>

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