'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'buyer' | 'vendor';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  company?: string;
  verified: boolean;
}

export interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  register: (email: string, password: string, displayName: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapFirebaseUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    name: fbUser.displayName ?? fbUser.email?.split('@')[0] ?? 'Admin',
    email: fbUser.email ?? '',
    role: 'buyer',
    verified: true,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!auth) { setIsLoading(false); return; }
    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? mapFirebaseUser(fbUser) : null);
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = useCallback(
    async (email: string, password: string, _role: UserRole): Promise<boolean> => {
      if (!auth) { console.error('[auth] Firebase not initialized'); return false; }
      try {
        await signInWithEmailAndPassword(auth, email, password);
        return true;
      } catch (err) {
        console.error('[auth] login failed:', err);
        return false;
      }
    },
    [],
  );

  const register = useCallback(
    async (email: string, password: string, displayName: string): Promise<{ ok: boolean; error?: string }> => {
      if (!auth) return { ok: false, error: 'Firebase not initialized' };
      try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName });
        return { ok: true };
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? '';
        if (code === 'auth/email-already-in-use') return { ok: false, error: 'Email already registered.' };
        if (code === 'auth/weak-password') return { ok: false, error: 'Password must be at least 6 characters.' };
        return { ok: false, error: 'Registration failed. Try again.' };
      }
    },
    [],
  );

  const loginWithGoogle = useCallback(async (): Promise<boolean> => {
    if (!auth) { console.error('[auth] Firebase not initialized'); return false; }
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      return true;
    } catch (err) {
      console.error('[auth] Google sign-in failed:', err);
      return false;
    }
  }, []);

  const logout = useCallback(() => {
    if (auth) signOut(auth);
  }, []);

  const value: AuthContextValue = {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    loginWithGoogle,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
