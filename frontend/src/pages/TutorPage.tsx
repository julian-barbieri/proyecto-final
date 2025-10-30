import { useAuthStore } from '../store/useAuthStore';

function TutorPage() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Tutor Area
          </h1>
          <p className="text-gray-600 mb-4">
            This area is only accessible to Tutors and Directors.
          </p>
          <div className="bg-green-50 border border-green-200 rounded p-4">
            <p className="text-green-800">
              Welcome, {user?.name}! (Role: {user?.role})
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TutorPage;

