import { create } from 'zustand';

export interface ICurrentUser {
  sub: string;
  name?: string;
  email?: string;
  role?: string;
}

interface AuthState {
  user: ICurrentUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: ICurrentUser | null) => void;
  setLoading: (isLoading: boolean) => void;
  setInitialized: (isInitialized: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isInitialized: false,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
  setInitialized: (isInitialized) => set({ isInitialized }),
}));
