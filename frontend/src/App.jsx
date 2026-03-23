import { Navigate, Route, Routes } from "react-router-dom";
import PageLayout from "./components/PageLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import AlumnoDetalle from "./pages/AlumnoDetalle";
import Alumnos from "./pages/Alumnos";
import AuthCallback from "./pages/AuthCallback";
import Contenido from "./pages/Contenido";
import ContenidoDocente from "./pages/ContenidoDocente";
import Dashboard from "./pages/Dashboard";
import GestionMaterias from "./pages/GestionMaterias";
import Inscripcion from "./pages/Inscripcion";
import Login from "./pages/Login";
import MateriaDetalle from "./pages/MateriaDetalle";
import Mensajes from "./pages/Mensajes";
import MisMateriasDocente from "./pages/MisMateriasDocente";
import MisCursos from "./pages/MisCursos";
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
          <ProtectedRoute allowedRoles={["docente"]}>
            <PageLayout
              title="Contenido"
              subtitle="Visualización y gestión de contenido académico"
            >
              <ContenidoDocente />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mensajes"
        element={
          <ProtectedRoute allowedRoles={["alumno", "docente", "coordinador"]}>
            <PageLayout
              title="Mensajes"
              subtitle="Comunicación entre alumnos, docentes y coordinadores"
            >
              <Mensajes />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/gestion-materias"
        element={
          <ProtectedRoute allowedRoles={["admin", "coordinador"]}>
            <PageLayout
              title="Gestión de materias"
              subtitle="Administrá asignaciones docentes y períodos de inscripción"
            >
              <GestionMaterias />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mis-materias"
        element={
          <ProtectedRoute allowedRoles={["docente"]}>
            <PageLayout
              title="Mis materias"
              subtitle="Materias activas e historial de asignaciones"
            >
              <MisMateriasDocente />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mis-cursos"
        element={
          <ProtectedRoute allowedRoles={["alumno"]}>
            <PageLayout
              title="Mis cursos"
              subtitle="Seguimiento de cursadas, finales pendientes y materias aprobadas"
            >
              <MisCursos />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/inscripcion"
        element={
          <ProtectedRoute allowedRoles={["alumno"]}>
            <PageLayout
              title="Inscripción"
              subtitle="Inscribite o date de baja en materias según período vigente"
            >
              <Inscripcion />
            </PageLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/mis-cursos/:materiaId"
        element={
          <ProtectedRoute allowedRoles={["alumno"]}>
            <PageLayout>
              <MateriaDetalle />
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
