'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  // Skip the onAuthStateChanged API call when login() already handled it
  const loginInProgressRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setFirebaseUser(fbUser);

      if (fbUser) {
        // If login() already set the user, skip the duplicate API call
        if (loginInProgressRef.current) {
          loginInProgressRef.current = false;
          setLoading(false);
          return;
        }

        // Page reload / returning user — try to restore session
        const existingToken = api.getToken();
        if (existingToken) {
          // We have a stored token — verify it by fetching profile
          try {
            const profileRes = await api.get<{ success: boolean; data: User }>('/auth/profile');
            if (profileRes.data) {
              setUser(profileRes.data);
            }
          } catch {
            // Stored token is invalid — try re-authenticating
            try {
              const idToken = await fbUser.getIdToken(true);
              const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', {
                idToken,
              });
              if (response.data) {
                api.setToken(response.data.token);
                setUser(response.data.user);
              }
            } catch {
              setUser(null);
              api.clearToken();
            }
          }
        } else {
          // No stored token — authenticate with backend
          try {
            const idToken = await fbUser.getIdToken();
            const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', {
              idToken,
            });
            if (response.data) {
              api.setToken(response.data.token);
              setUser(response.data.user);
            }
          } catch {
            setUser(null);
            api.clearToken();
          }
        }
      } else {
        setUser(null);
        api.clearToken();
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    // Mark that we're handling auth — so onAuthStateChanged skips the API call
    loginInProgressRef.current = true;

    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const idToken = await credential.user.getIdToken();
    const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', {
      idToken,
    });

    if (response.data) {
      api.setToken(response.data.token);
      setUser(response.data.user);
      setLoading(false);
    }
  };

  const logout = async () => {
    await firebaseSignOut(firebaseAuth);
    api.clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
