import { useEffect, useState } from 'react';
import axios from 'axios';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  commit: string;
  version: string;
}

function HomePage() {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [aiHealth, setAiHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const [backend, ai] = await Promise.all([
          axios.get<HealthResponse>('http://localhost:3001/health'),
          axios.get<HealthResponse>('http://localhost:8000/health'),
        ]);
        setBackendHealth(backend.data);
        setAiHealth(ai.data);
      } catch (error) {
        console.error('Error fetching health:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            ✅ It Works!
          </h1>
          <p className="text-gray-600">
            Edu Predict MVP - Sprint 0
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading health checks...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {backendHealth && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-800 mb-2">Backend Service</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">Status:</span> {backendHealth.status}</p>
                  <p><span className="font-medium">Commit:</span> {backendHealth.commit}</p>
                  <p><span className="font-medium">Version:</span> {backendHealth.version}</p>
                </div>
              </div>
            )}

            {aiHealth && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h3 className="font-semibold text-purple-800 mb-2">AI Service</h3>
                <div className="text-sm text-gray-700 space-y-1">
                  <p><span className="font-medium">Status:</span> {aiHealth.status}</p>
                  <p><span className="font-medium">Commit:</span> {aiHealth.commit}</p>
                  <p><span className="font-medium">Version:</span> {aiHealth.version}</p>
                </div>
              </div>
            )}

            {(!backendHealth || !aiHealth) && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800">
                  Some services are not responding. Make sure all containers are running.
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 text-center">
            Docker Compose status: All services operational
          </p>
        </div>
      </div>
    </div>
  );
}

export default HomePage;

