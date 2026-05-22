import { create } from 'zustand';
import client from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  register: (username: string, email: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('token'),
  loading: false,
  error: null,

  register: async (username: string, email: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await client.post('/auth/register', { username, email, password });
      localStorage.setItem('token', response.data.token);
      set({ token: response.data.token });
      await useAuth.getState().checkAuth();
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Registration failed' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  login: async (username: string, password: string) => {
    set({ loading: true, error: null });
    try {
      const response = await client.post('/auth/login', { username, password });
      localStorage.setItem('token', response.data.token);
      set({ token: response.data.token });
      await useAuth.getState().checkAuth();
    } catch (error: any) {
      set({ error: error.response?.data?.error || 'Login failed' });
      throw error;
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },

  checkAuth: async () => {
    try {
      const response = await client.get('/auth/me');
      set({ user: response.data });
    } catch (error) {
      set({ user: null });
    }
  },
}));
