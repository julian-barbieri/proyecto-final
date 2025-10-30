import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { authAPI } from '../lib/api';

declare global {
  interface Window {
    google?: any;
  }
}

function LoginPage() {
  const navigate = useNavigate();
  const { token, login, setLoading } = useAuthStore();
  const buttonDivRef = useRef<HTMLDivElement>(null);
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  useEffect(() => {
    // If already authenticated, redirect to dashboard
    if (token) {
      navigate('/dashboard');
      return;
    }

    // Initialize Google Sign-In
    const initializeGoogleSignIn = () => {
      if (window.google && buttonDivRef.current) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
        });

        window.google.accounts.id.renderButton(buttonDivRef.current, {
          theme: 'filled_blue',
          size: 'large',
          width: 250,
        });
      }
    };

    // Load Google Sign-In script
    const loadGoogleScript = () => {
      if (!window.google) {
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = initializeGoogleSignIn;
        document.body.appendChild(script);
      } else {
        initializeGoogleSignIn();
      }
    };

    loadGoogleScript();
  }, [token, navigate, GOOGLE_CLIENT_ID]);

  const handleCredentialResponse = async (response: any) => {
    try {
      setLoading(true);
      
      // Call backend to exchange id_token for JWT
      const authResponse = await authAPI.googleLogin(response.credential);
      
      // Store token and user in auth store
      login(authResponse.token, authResponse.user);
      
      // Redirect to dashboard
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Authentication failed:', error);
      
      // Show error message to user
      const errorMessage = error.response?.data?.message || 'Authentication failed';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Edu Predict MVP
          </h1>
          <p className="text-gray-600">
            Sign in with your institutional email
          </p>
        </div>

        <div className="flex justify-center mb-4">
          <div ref={buttonDivRef}></div>
        </div>

        <p className="text-sm text-gray-500 text-center">
          Only @usal.edu.ar emails are allowed
        </p>
      </div>
    </div>
  );
}

export default LoginPage;

