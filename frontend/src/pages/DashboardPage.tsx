import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../lib/api';

function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const roleColors: Record<string, string> = {
    DIRECTOR: 'bg-purple-100 text-purple-800',
    TUTOR: 'bg-blue-100 text-blue-800',
    PROFESOR: 'bg-green-100 text-green-800',
    ALUMNO: 'bg-gray-100 text-gray-800',
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Edu Predict MVP</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.name} ({user?.role})
            </span>
            <button
              onClick={async () => {
                try {
                  // Call logout endpoint (optional, mainly for logging)
                  await authAPI.logout().catch(() => {
                    // Ignore errors - logout should work even if endpoint fails
                  });
                } finally {
                  // Always clear client-side state
                  const { logout } = useAuthStore.getState();
                  logout();
                  navigate('/login');
                }
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Welcome, {user?.name}!
            </h2>
            <p className="text-gray-600">
              Email: {user?.email}
            </p>
          </div>

          {/* Role Badge */}
          <div className="mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              roleColors[user?.role || 'ALUMNO']
            }`}>
              {user?.role}
            </span>
          </div>

          {/* Navigation Links */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/common')}
              className="p-4 border rounded-lg hover:bg-gray-50 text-left"
            >
              <h3 className="font-semibold">Common Access</h3>
              <p className="text-sm text-gray-600">Available to all users</p>
            </button>

            {(user?.role === 'DIRECTOR' || user?.role === 'TUTOR') && (
              <button
                onClick={() => navigate('/tutor')}
                className="p-4 border rounded-lg hover:bg-gray-50 text-left"
              >
                <h3 className="font-semibold">Tutor Area</h3>
                <p className="text-sm text-gray-600">For tutors and directors</p>
              </button>
            )}

            {user?.role === 'DIRECTOR' && (
              <button
                onClick={() => navigate('/director')}
                className="p-4 border rounded-lg hover:bg-gray-50 text-left"
              >
                <h3 className="font-semibold">Director Area</h3>
                <p className="text-sm text-gray-600">Only for directors</p>
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;

