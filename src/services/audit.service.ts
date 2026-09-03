// ═══════════════════════════════════════════════════════════
// AUDIT TRAIL — Kaun ne kya kiya, kab kiya
// ───────────────────────────────────────────────────────────
// YE KYA KARTA HAI:
//   Jab bhi koi important kaam hota hai (trainee add, leave approve,
//   document upload, etc.), ye uska record Firestore mein save karta hai.
//   Baad mein CC dekh sakta hai ki kisne kya kiya.
//
// KYUN ZAROORI HAI:
//   Agar koi galti kare toh pata chal jaaye ki kisne kiya.
//   Defense mein accountability bahut zaroori hai.
//
// FREE HAI?
//   ✅ Haan! Firestore mein data save hota hai. Free tier mein kaafi hai.
//
// KAISE USE KAREIN:
//   Kisi bhi file mein import karo:
//     import { logActivity } from '../services/audit.service';
//
//   Phir jab bhi kuch important ho:
//     await logActivity({
//       action: 'create',
//       module: 'trainees',
//       recordId: 'trainee123',
//       description: 'Naya trainee add kiya: Ramesh Kumar',
//       userId: user.uid,
//       userName: user.name,
//       userRole: user.role,
//     });
// ═══════════════════════════════════════════════════════════

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';

// Kya action hua? (create, update, delete, login, logout, etc.)
export type AuditAction =
  | 'create' | 'update' | 'delete'
  | 'login' | 'logout'
  | 'approve' | 'reject'
  | 'export' | 'import'
  | 'upload' | 'download'
  | 'backup' | 'restore';

// Kis module mein hua? (trainees, staff, finance, etc.)
export type AuditModule =
  | 'trainees' | 'staff' | 'attendance' | 'leave'
  | 'finance' | 'inventory' | 'documents' | 'inspections'
  | 'findings' | 'batches' | 'users' | 'system' | 'auth';

// Audit entry ka structure
interface AuditEntry {
  action: AuditAction;       // Kya kiya?
  module: AuditModule;       // Kis cheez mein kiya?
  recordId?: string;         // Kis record pe kiya?
  description: string;       // Detail mein batao kya hua
  userId: string;            // Kisne kiya? (UID)
  userName: string;          // Kisne kiya? (Naam)
  userRole: string;          // Uski kya role hai?
  changes?: Record<string, { before: any; after: any }>;  // Kya badla?
  metadata?: Record<string, any>;  // Extra info
}

/**
 * Activity log mein entry likho.
 * Ye background mein chalta hai — UI block nahi hoga.
 *
 * EXAMPLE:
 *   await logActivity({
 *     action: 'create',
 *     module: 'trainees',
 *     recordId: 'abc123',
 *     description: 'Naya trainee add kiya: Ramesh Kumar, Chest 1022',
 *     userId: 'user123',
 *     userName: 'Clerk Sahab',
 *     userRole: 'Clerk',
 *   });
 */
export async function logActivity(entry: AuditEntry): Promise<void> {
  try {
    await addDoc(collection(db, 'activity_logs'), {
      ...entry,
      timestamp: serverTimestamp(),  // Firebase apna time lagayega
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    // Agar log likhne mein error aaye toh app mat todo — sirf console mein dikhao
    console.warn('Audit log nahi likh paya:', err);
  }
}

/**
 * Shortcut: CRUD action log karo (Create/Update/Delete)
 *
 * EXAMPLE:
 *   await logCrud('update', 'trainees', 'abc123', 'Trainee ka platoon badla',
 *     { uid: user.uid, name: user.name, role: user.role },
 *     { platoon: { before: 'A', after: 'B' } }
 *   );
 */
export async function logCrud(
  action: 'create' | 'update' | 'delete',
  module: AuditModule,
  recordId: string,
  description: string,
  user: { uid: string; name: string; role: string },
  changes?: Record<string, { before: any; after: any }>
) {
  return logActivity({
    action,
    module,
    recordId,
    description,
    userId: user.uid,
    userName: user.name,
    userRole: user.role,
    changes,
  });
}

/**
 * Shortcut: Login/Logout log karo
 *
 * EXAMPLE:
 *   await logAuth('login', { uid: user.uid, name: user.name, role: user.role });
 */
export async function logAuth(
  action: 'login' | 'logout',
  user: { uid: string; name: string; role: string }
) {
  return logActivity({
    action,
    module: 'auth',
    description: `User ${action === 'login' ? 'login hua' : 'logout hua'}: ${user.name} (${user.role})`,
    userId: user.uid,
    userName: user.name,
    userRole: user.role,
  });
}

/**
 * Shortcut: System event log karo (backup, restore, etc.)
 *
 * EXAMPLE:
 *   await logSystem('backup', 'Daily backup complete ho gaya');
 */
export async function logSystem(
  action: AuditAction,
  description: string,
  metadata?: Record<string, any>
) {
  return logActivity({
    action,
    module: 'system',
    description,
    userId: 'system',
    userName: 'System',
    userRole: 'system',
    metadata,
  });
}
