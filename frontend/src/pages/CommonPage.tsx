import { useAuthStore } from '../store/useAuthStore';

function CommonPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Common Page
          </h1>
          <p className="text-gray-600 mb-4">
            This page is accessible to all authenticated users.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded p-4">
            <p className="text-blue-800">
              Hello, {user?.name}! (Role: {user?.role})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CommonPage;

