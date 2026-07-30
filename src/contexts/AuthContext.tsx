// D:\ALL PROJECTS\BSF COYs\frontend\src\contexts\AuthContext.tsx

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { SESSION_TIMEOUT_MS, SESSION_EXPIRED_FLAG } from '../features/system/authSecurity';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (firebaseUser: FirebaseUser | null) => {
        if (firebaseUser) {
          await loadUserData(firebaseUser);
        } else {
          setUser(null);
          setLoading(false);
        }
      }
    );
    return () => unsubscribe();
  }, []);

  // ★ NEW ─── SESSION TIMEOUT (30 min inactivity → auto logout) ──
  // Govt ERP security requirement: idle terminal pe session khula
  // nahi rehna chahiye. User activity (mouse/keyboard/touch) pe
  // timer reset hota hai. Expire hone pe LoginScreen pe notice
  // dikhane ke liye sessionStorage flag set karte hain.
  useEffect(() => {
    if (!user) return; // Sirf logged-in state mein chalega

    let timeoutId: ReturnType<typeof setTimeout>;
    let lastReset = Date.now();
    const EVENTS: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart',
    ];

    const expireSession = () => {
      sessionStorage.setItem(SESSION_EXPIRED_FLAG, '1');
      void logout();
    };

    const armTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(expireSession, SESSION_TIMEOUT_MS);
    };

    const onActivity = () => {
      // Throttle: har 30 sec mein max 1 baar reset (perf)
      const now = Date.now();
      if (now - lastReset < 30_000) return;
      lastReset = now;
      armTimer();
    };

    EVENTS.forEach(ev => window.addEventListener(ev, onActivity, { passive: true }));
    armTimer();

    return () => {
      clearTimeout(timeoutId);
      EVENTS.forEach(ev => window.removeEventListener(ev, onActivity));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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
          role:        String(userData['role']        ?? 'Unassigned'),
          phone:       String(userData['phone']       ?? 'N/A'),
          designation: String(userData['designation'] ?? 'Unassigned'),
          isActive:    Boolean(userData['isActive']   ?? false),
          createdBy:   String(userData['createdBy']   ?? 'Unknown'),
        });
      } else {
        console.warn(`User doc not found in Firestore for uid: ${firebaseUser.uid}`);
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
        });
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
      };

      if (fbErr.code === 'unauthenticated') {
        console.warn('Auth token expired. Logging out.');
        setUser(null);
      } else if (fbErr.code === 'permission-denied') {
        console.warn('Firestore permission denied. Using basic auth info.');
        setUser(fallbackUser);
      } else if (fbErr.code === 'unavailable') {
        console.warn('Firestore unavailable. Keeping session alive.');
        setUser(fallbackUser);
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
          role:        String(userData['role']        ?? 'Unassigned'),
          phone:       String(userData['phone']       ?? 'N/A'),
          designation: String(userData['designation'] ?? 'Unassigned'),
          isActive:    Boolean(userData['isActive']   ?? false),
          createdBy:   String(userData['createdBy']   ?? 'Unknown'),
        });

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