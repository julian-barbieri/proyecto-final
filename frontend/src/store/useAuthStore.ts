import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AuthState, User } from '../types';

interface AuthStore extends AuthState {}

const STORAGE_KEY = 'edu-predict-auth';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      loading: false,
      login: (token: string, user: User) => {
        set({ token, user, loading: false });
      },
      logout: () => {
        set({ token: null, user: null, loading: false });
      },
      setLoading: (loading: boolean) => {
        set({ loading });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ 
        token: state.token, 
        user: state.user 
      }),
    }
  )
);

