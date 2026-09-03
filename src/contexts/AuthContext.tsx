// D:\ALL PROJECTS\BSF COYs\frontend\src\contexts\AuthContext.tsx

import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, where,
} from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { setDevViewer } from '../utils/devDataFilter';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
const normalizeRole = (value: unknown): string => {
  const key = String(value ?? '').trim().toLowerCase();
  if (key === 'qm' || key === 'quartermaster') return 'Quarter Master';
  if (key === 'cc' || key === 'commander' || key === 'company commander') return 'Company Commander';
  if (key === 'clerk') return 'Clerk';
  if (key === 'ustad' || key === 'instructor') return 'Ustad';
  if (key === 'so' || key === 'senior officer' || key === 'inspector'
      || key === 'senior officer / inspector' || key === 'senior officer/inspector')
    return 'Senior Officer / Inspector';
  if (key === 'trainee' || key === 'trainee senior' || key === 'course trainee senior'
      || key === 'senior trainee' || key === 'course trainee' || key === 'cts')
    return 'Trainee';
  return String(value ?? 'Unassigned');
};

/** Trainee Senior must never enter the developer sandbox — they follow the company active batch. */
const asDevViewer = (userData: Record<string, unknown>): boolean =>
  Boolean(userData['isDeveloper'] ?? false) && normalizeRole(userData['role']) !== 'Trainee';

interface AppUser {
  uid: string;
  email: string | null;
  displayName?: string | null;
  name: string;
  role: string;
  phone: string;
  designation: string;
  isActive: boolean;
  createdBy: string;
  isDeveloper: boolean; // 🧪 Dev/Practice account flag
  customerId?: string | null; // 👑 Customer (CC) account ki Customer ID
  assignedBatchIds?: string[]; // 🔎 Senior Officer/Inspector assigned batches
}

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>; // ★ NEW
}

// ─────────────────────────────────────────────
// CONTEXT
// ─────────────────────────────────────────────
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ─────────────────────────────────────────────
// FIRESTORE ERROR CODES
// ─────────────────────────────────────────────
type FirebaseErrorCode =
  | 'permission-denied'
  | 'unauthenticated'
  | 'unavailable'
  | 'not-found'
  | 'cancelled'
  | 'unknown'
  | string;

interface FirebaseError {
  code?: FirebaseErrorCode;
  message?: string;
}

// ─────────────────────────────────────────────
// PROVIDER
// ─────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser]       = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time profile listener — so role changes / deactivation made by the
  // Company Commander take effect in the active session immediately, instead
  // of the session retaining stale elevated access until next login.
  const profileUnsubRef = useRef<(() => void) | null>(null);

  const stopProfileListener = () => {
    if (profileUnsubRef.current) {
      profileUnsubRef.current();
      profileUnsubRef.current = null;
    }
  };

  /** Attach a live listener to the signed-in user's profile document. */
  const watchProfile = (firebaseUser: FirebaseUser, legacyEmailFallback = false) => {
    stopProfileListener();
    const applyData = (userData: Record<string, any>) => {
      setUser({
        uid:         firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: firebaseUser.displayName,
        name:        String(userData['name']        ?? firebaseUser.displayName ?? 'User'),
        role:        normalizeRole(userData['role']),
        phone:       String(userData['phone']       ?? 'N/A'),
        designation: String(userData['designation'] ?? 'Unassigned'),
        isActive:    userData['isActive'] !== false,
        createdBy:   String(userData['createdBy']   ?? 'Unknown'),
        isDeveloper: Boolean(userData['isDeveloper'] ?? false) && normalizeRole(userData['role']) !== 'Trainee',
        customerId:  userData['customerId'] != null ? String(userData['customerId']) : null,
        assignedBatchIds: Array.isArray(userData["assignedBatchIds"]) ? userData["assignedBatchIds"].map(String) : [],
      });
      setDevViewer(Boolean(userData['isDeveloper'] ?? false) && normalizeRole(userData['role']) !== 'Trainee');
    };

    profileUnsubRef.current = onSnapshot(
      doc(db, 'users', firebaseUser.uid),
      (snap) => {
        if (snap.exists()) {
          applyData(snap.data() as Record<string, any>);
        } else if (legacyEmailFallback && firebaseUser.email) {
          // Legacy profile keyed by a random id — poll once via email lookup.
          getDocs(query(collection(db, 'users'), where('email', '==', firebaseUser.email)))
            .then(legacySnap => {
              if (!legacySnap.empty) applyData(legacySnap.docs[0].data() as Record<string, any>);
            })
            .catch(() => { /* static fallback already set */ });
        }
        setLoading(false);
      },
      () => {
        // Permission/transient errors: keep the session with basic info.
        setLoading(false);
      },
    );
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          await loadUserData(firebaseUser);
          // Keep authorization state current for the lifetime of the session.
          watchProfile(firebaseUser, true);
        } else {
          stopProfileListener();
          setUser(null);
          setDevViewer(false);
          setLoading(false);
        }
      }
    );
    return () => { unsubscribe(); stopProfileListener(); };
  }, []);

  // ─── LOAD USER DATA FROM FIRESTORE ───────
  const loadUserData = async (firebaseUser: FirebaseUser) => {
    try {
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc    = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        setUser({
          uid:         firebaseUser.uid,
          email:       firebaseUser.email,
          displayName: firebaseUser.displayName,
          name:        String(userData['name']        ?? 'Unknown User'),
          role:        normalizeRole(userData['role']),
          phone:       String(userData['phone']       ?? 'N/A'),
          designation: String(userData['designation'] ?? 'Unassigned'),
          isActive:    userData['isActive'] !== false,
          createdBy:   String(userData['createdBy']   ?? 'Unknown'),
          isDeveloper: asDevViewer(userData),
          customerId:  userData['customerId'] != null ? String(userData['customerId']) : null,
          assignedBatchIds: Array.isArray(userData["assignedBatchIds"]) ? userData["assignedBatchIds"].map(String) : [],
        });
        setDevViewer(asDevViewer(userData));
      } else {
        // Older User Management records used a random document id. Fall back
        // to email lookup so those authenticated staff profiles still work.
        const legacySnap = firebaseUser.email
          ? await getDocs(query(collection(db, 'users'), where('email', '==', firebaseUser.email)))
          : { empty: true, docs: [] as never[] };
        if (!legacySnap.empty) {
          const userData = legacySnap.docs[0].data();
          const isDev = asDevViewer(userData);
          setUser({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName,
            name:        String(userData['name']        ?? firebaseUser.displayName ?? 'User'),
            role:        normalizeRole(userData['role']),
            phone:       String(userData['phone']       ?? 'N/A'),
            designation: String(userData['designation'] ?? 'Unassigned'),
            isActive:    userData['isActive'] !== false,
            createdBy:   String(userData['createdBy']   ?? 'Unknown'),
            isDeveloper: isDev,
            customerId:  userData['customerId'] != null ? String(userData['customerId']) : null,
          });
          setDevViewer(isDev);
        } else {
          console.warn(`User doc not found for uid or email: ${firebaseUser.uid}`);
          setUser({
            uid:         firebaseUser.uid,
            email:       firebaseUser.email,
            displayName: firebaseUser.displayName,
            name:        firebaseUser.displayName ?? 'Pending User',
            role:        'Unassigned',
            phone:       'N/A',
            designation: 'Unassigned',
            isActive:    false,
            createdBy:   'Unknown',
            isDeveloper: false,
          });
          setDevViewer(false);
        }
      }

    } catch (error: unknown) {
      const fbErr = error as FirebaseError;
      console.error('Firestore user data fetch error:', fbErr.message ?? error);

      const fallbackUser: AppUser = {
        uid:         firebaseUser.uid,
        email:       firebaseUser.email,
        displayName: firebaseUser.displayName,
        name:        firebaseUser.displayName ?? firebaseUser.email ?? 'User',
        role:        'Unassigned',
        phone:       'N/A',
        designation: 'Unassigned',
        isActive:    false,
        createdBy:   'Unknown',
        isDeveloper: false,
      };

      if (fbErr.code === 'unauthenticated') {
        console.warn('Auth token expired. Logging out.');
        setUser(null);
        setDevViewer(false);
      } else if (fbErr.code === 'permission-denied') {
        console.warn('Firestore permission denied. Using basic auth info.');
        setUser(fallbackUser);
      } else if (fbErr.code === 'unavailable') {
        console.warn('Firestore unavailable. Keeping session alive.');
        setUser(fallbackUser);
        setDevViewer(false);
      } else {
        console.error('Unknown error loading user data.', fbErr);
        setUser(fallbackUser);
      }

    } finally {
      setLoading(false);
    }
  };

  // ★ NEW ─── REFRESH USER (Profile update ke baad call karo) ──
  // Firestore se fresh data load karta hai bina logout kiye
  const refreshUser = async (): Promise<void> => {
    try {
      const currentFirebaseUser = auth.currentUser;

      // ── Guard: Firebase Auth mein koi logged in nahi ──
      if (!currentFirebaseUser) {
        console.warn('refreshUser: No Firebase user found');
        return;
      }

      const userDocRef = doc(db, 'users', currentFirebaseUser.uid);
      const userDoc    = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();

        // ★ setUser ke through React state update hogi
        // → pura app automatically naya name/phone/designation dikhayega
        setUser({
          uid:         currentFirebaseUser.uid,
          email:       currentFirebaseUser.email,
          displayName: currentFirebaseUser.displayName,
          name:        String(userData['name']        ?? 'Unknown User'),
          role:        normalizeRole(userData['role']),
          phone:       String(userData['phone']       ?? 'N/A'),
          designation: String(userData['designation'] ?? 'Unassigned'),
          isActive:    userData['isActive'] !== false,
          createdBy:   String(userData['createdBy']   ?? 'Unknown'),
          isDeveloper: asDevViewer(userData),
          customerId:  userData['customerId'] != null ? String(userData['customerId']) : null,
          assignedBatchIds: Array.isArray(userData["assignedBatchIds"]) ? userData["assignedBatchIds"].map(String) : [],
        });
        setDevViewer(asDevViewer(userData));

        console.log('✓ User data refreshed from Firestore');
      } else {
        console.warn('refreshUser: User doc not found in Firestore');
      }

    } catch (error: unknown) {
      const fbErr = error as FirebaseError;
      // ★ Refresh fail hone pe session mat todo — sirf log karo
      console.error('refreshUser error (session intact):', fbErr.message ?? error);
    }
  };

  // ─── LOGIN ────────────────────────────────
  const login = async (email: string, pass: string): Promise<void> => {
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, pass);
      // onAuthStateChanged automatically user data load karega
    } catch (error: unknown) {
      const fbErr = error as FirebaseError;
      console.error('Login error:', fbErr.message ?? error);
      setLoading(false);
      throw error;
    }
  };

  // ─── LOGOUT ───────────────────────────────
  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      await signOut(auth);
      setUser(null);
      setDevViewer(false);
    } catch (error: unknown) {
      const fbErr = error as FirebaseError;
      console.error('Logout error:', fbErr.message ?? error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // ─── CONTEXT VALUE ────────────────────────
  const contextValue: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshUser, // ★ NEW
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ─────────────────────────────────────────────
// CUSTOM HOOK
// ─────────────────────────────────────────────
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// ─────────────────────────────────────────────
// ROLE HELPER HOOKS
// ─────────────────────────────────────────────
export const useHasRole = (role: string): boolean => {
  const { user } = useAuth();
  return user?.role?.toLowerCase() === role.toLowerCase();
};

export const useIsActiveUser = (): boolean => {
  const { user } = useAuth();
  return user?.isActive === true;
};

export const useUserRole = (): string => {
  const { user } = useAuth();
  return user?.role?.toLowerCase() ?? 'unassigned';
};
