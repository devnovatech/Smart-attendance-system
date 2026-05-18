import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User as FirebaseUser } from '@firebase/auth';
import { firebaseAuth } from '../lib/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = 'cached_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Persist user data to AsyncStorage whenever it changes
  const cacheUser = async (userData: User | null) => {
    setUser(userData);
    if (userData) {
      await AsyncStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
    } else {
      await AsyncStorage.removeItem(USER_STORAGE_KEY);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          // Check if we already have a cached user and valid token
          const existingToken = await api.getToken();
          const cachedUserStr = await AsyncStorage.getItem(USER_STORAGE_KEY);

          if (existingToken && cachedUserStr) {
            // Restore cached user immediately for fast app startup
            const cachedUser = JSON.parse(cachedUserStr) as User;
            setUser(cachedUser);
            setLoading(false);

            // Refresh token in background (silent re-auth)
            fbUser.getIdToken().then(async (idToken) => {
              try {
                const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', { idToken });
                if (response.data) {
                  await api.setToken(response.data.token);
                  await cacheUser(response.data.user);
                }
              } catch {
                // Token refresh failed silently - user can still use cached session
              }
            });
            return;
          }

          // No cached session - do full login
          const idToken = await fbUser.getIdToken();
          const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', { idToken });
          if (response.data) {
            await api.setToken(response.data.token);
            await cacheUser(response.data.user);
          }
        } catch {
          await cacheUser(null);
          await api.clearToken();
        }
      } else {
        await cacheUser(null);
        await api.clearToken();
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const credential = await signInWithEmailAndPassword(firebaseAuth, email, password);
    const idToken = await credential.user.getIdToken();
    const response = await api.post<{ data: { token: string; user: User } }>('/auth/login', { idToken });
    if (response.data) {
      await api.setToken(response.data.token);
      await cacheUser(response.data.user);
    }
  };

  const logout = async () => {
    await signOut(firebaseAuth);
    await api.clearToken();
    await cacheUser(null);
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
