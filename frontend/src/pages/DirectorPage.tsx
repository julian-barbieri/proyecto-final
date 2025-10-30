import { useAuthStore } from '../store/useAuthStore';

function DirectorPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Director Area
          </h1>
          <p className="text-gray-600 mb-4">
            This area is only accessible to Directors.
          </p>
          <div className="bg-purple-50 border border-purple-200 rounded p-4">
            <p className="text-purple-800">
              Welcome, Director {user?.name}!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DirectorPage;

