import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CommonPage from './pages/CommonPage';
import TutorPage from './pages/TutorPage';
import DirectorPage from './pages/DirectorPage';
import NotFoundPage from './pages/NotFoundPage';
import ForbiddenPage from './pages/ForbiddenPage';
import { PrivateRoute } from './components/PrivateRoute';
import { RoleGuard } from './components/RoleGuard';
import { Role } from './types';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/common"
          element={
            <PrivateRoute>
              <CommonPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/tutor"
          element={
            <PrivateRoute>
              <RoleGuard allowedRoles={['TUTOR', 'DIRECTOR']}>
                <TutorPage />
              </RoleGuard>
            </PrivateRoute>
          }
        />
        <Route
          path="/director"
          element={
            <PrivateRoute>
              <RoleGuard allowedRoles={['DIRECTOR']}>
                <DirectorPage />
              </RoleGuard>
            </PrivateRoute>
          }
        />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="/404" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Router>
  );
}

export default App;

