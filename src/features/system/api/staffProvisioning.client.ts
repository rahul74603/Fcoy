// ═══════════════════════════════════════════════════════════
// STAFF PROVISIONING — client-side with secondary app
// Creates Auth account WITHOUT signing out the CC
// ═══════════════════════════════════════════════════════════

import { getAuth as getAuthSecondary, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { getApps, initializeApp } from 'firebase/app';
import { doc, setDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../../../config/firebase';

export interface CreateStaffInput {
  name: string;
  email: string;
  password: string;
  role: string;
  phone?: string;
  designation?: string;
  assignedBatchIds?: string[];
}

export interface CreateStaffResult {
  uid: string;
  email: string;
  role: string;
}

// Secondary Firebase app — CC session kabhi switch nahi hota
function getSecondaryAuth() {
  const secondary = getApps().find(a => a.name === 'staff-provisioner')
    || initializeApp(firebaseConfig, 'staff-provisioner');
  return getAuthSecondary(secondary);
}

/**
 * Provision a staff login account.
 * Uses secondary Firebase app so CC stays logged in.
 */
export async function createStaffAccount(input: CreateStaffInput): Promise<CreateStaffResult> {
  try {
    const secondaryAuth = getSecondaryAuth();

    // 1) Create Firebase Auth account (in secondary app — CC session unaffected)
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, input.email, input.password);
    const newUid = userCredential.user.uid;

    // 2) Update display name
    await updateProfile(userCredential.user, { displayName: input.name });

    // 3) Create Firestore profile (doc id = auth uid)
    const { getAuth } = await import('firebase/auth');
    const primaryAuth = getAuth();
    await setDoc(doc(db, 'users', newUid), {
      name: input.name,
      email: input.email,
      role: input.role,
      phone: input.phone || '',
      designation: input.designation || '',
      isActive: true,
      isDeveloper: false,
      assignedBatchIds: input.assignedBatchIds || [],
      createdAt: new Date().toISOString(),
      createdBy: primaryAuth.currentUser?.uid || 'unknown',
    });

    // 4) Sign out from secondary app (cleanup)
    await secondaryAuth.signOut();

    return { uid: newUid, email: input.email, role: input.role };
  } catch (e: any) {
    const code = e?.code || '';
    if (code === 'auth/email-already-in-use') {
      throw new Error('Ye email pehle se registered hai.');
    }
    if (code === 'auth/weak-password') {
      throw new Error('Password kam se kam 6 characters ka ho.');
    }
    if (code === 'auth/invalid-email') {
      throw new Error('Email galat hai.');
    }
    throw new Error(e?.message || 'Staff account create nahi ho paya.');
  }
}
