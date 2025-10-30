import axios from 'axios';
import { User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('edu-predict-auth');
  if (token) {
    try {
      const parsed = JSON.parse(token);
      if (parsed.state?.token) {
        config.headers.Authorization = `Bearer ${parsed.state.token}`;
      }
    } catch (error) {
      // Ignore parsing errors
    }
  }
  return config;
});

export interface AuthResponse {
  token: string;
  user: User;
}

export const authAPI = {
  googleLogin: async (idToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/api/auth/google', { idToken });
    return response.data;
  },
  
  logout: async (): Promise<void> => {
    await api.post('/api/auth/logout');
  },
  
  getMe: async (): Promise<User> => {
    const response = await api.get<User>('/api/me');
    return response.data;
  },
};

export default api;

