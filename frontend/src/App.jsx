import { Navigate, Route, Routes } from "react-router-dom";
import PageLayout from "./components/PageLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AlumnoDetalle from "./pages/AlumnoDetalle";
import Alumnos from "./pages/Alumnos";
import AuthCallback from "./pages/AuthCallback";
import Contenido from "./pages/Contenido";
import ContenidoDocente from "./pages/ContenidoDocente";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import Predicciones from "./pages/Predicciones";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <PageLayout
              title="Dashboard"
              subtitle="Resumen general del sistema y últimas predicciones registradas."
            >
              <Dashboard />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/predicciones"
        element={
          <ProtectedRoute allowedRoles={["admin", "docente", "coordinador"]}>
            <PageLayout
              title="Predicciones"
              subtitle="Ejecutá predicciones de abandono, recursado y nota de examen."
            >
              <Predicciones />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contenido"
        element={
          <ProtectedRoute allowedRoles={["alumno"]}>
            <PageLayout
              title="Contenido"
              subtitle="Material académico publicado por tus tutores"
            >
              <Contenido />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/contenido-docente"
        element={
          <ProtectedRoute allowedRoles={["docente", "admin"]}>
            <PageLayout
              title="Cargar contenido"
              subtitle="Publicá material académico para tus alumnos"
            >
              <ContenidoDocente />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/alumnos"
        element={
          <ProtectedRoute allowedRoles={["admin", "coordinador"]}>
            <PageLayout
              title="Gestión de Alumnos"
              subtitle="Buscá alumnos y accedé a sus predicciones académicas."
            >
              <Alumnos />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/alumnos/:id"
        element={
          <ProtectedRoute allowedRoles={["admin", "coordinador", "docente"]}>
            <PageLayout>
              <AlumnoDetalle />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
