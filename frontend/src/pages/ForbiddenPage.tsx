import { Link } from 'react-router-dom';

function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900">403</h1>
        <p className="text-xl text-gray-600 mt-4">Access Forbidden</p>
        <p className="text-gray-500 mt-2">
          You don't have permission to access this resource.
        </p>
        <Link
          to="/dashboard"
          className="mt-8 inline-block px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}

export default ForbiddenPage;

