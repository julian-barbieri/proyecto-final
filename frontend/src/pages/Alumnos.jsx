import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import LoadingSpinner from "../components/LoadingSpinner";

const PAGE_SIZE = 10;

export default function Alumnos() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .get("/api/students")
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err.message || "Error al cargar alumnos"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = students.filter(
    (s) =>
      s.Nombre.toLowerCase().includes(search.toLowerCase()) ||
      s.IdAlumno.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const from = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, filtered.length);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Cargando alumnos..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nombre o ID..."
          value={search}
          onChange={handleSearch}
          className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <svg
          className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="hidden w-full text-sm md:table">
          <thead className="hidden bg-slate-50 text-xs uppercase tracking-wide text-slate-500 md:table-header-group">
            <tr>
              <th className="px-4 py-3 text-left">ID Alumno</th>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Género</th>
              <th className="px-4 py-3 text-left">Edad</th>
              <th className="px-4 py-3 text-left">Año Ingreso</th>
              <th className="px-4 py-3 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-400"
                >
                  No se encontraron alumnos.
                </td>
              </tr>
            ) : (
              paginated.map((s) => (
                <tr key={s.IdAlumno} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-slate-600">
                    {s.IdAlumno}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {s.Nombre}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        s.Genero === 0
                          ? "bg-pink-100 text-pink-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {s.Genero === 0 ? "Femenino" : "Masculino"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.Edad}</td>
                  <td className="px-4 py-3 text-slate-600">{s.AnioIngreso}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => navigate(`/alumnos/${s.IdAlumno}`)}
                      className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      Ver predicciones
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="space-y-3 p-3 md:hidden">
          {paginated.length === 0 ? (
            <div className="rounded-lg border border-slate-200 p-4 text-center text-slate-400">
              No se encontraron alumnos.
            </div>
          ) : (
            paginated.map((s) => (
              <article
                key={s.IdAlumno}
                className="rounded-lg border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs text-slate-500">
                      {s.IdAlumno}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-900">
                      {s.Nombre}
                    </h3>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      s.Genero === 0
                        ? "bg-pink-100 text-pink-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {s.Genero === 0 ? "Femenino" : "Masculino"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <p>Edad: {s.Edad}</p>
                  <p>Año ingreso: {s.AnioIngreso}</p>
                </div>

                <button
                  onClick={() => navigate(`/alumnos/${s.IdAlumno}`)}
                  className="mt-4 w-full rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Ver predicciones
                </button>
              </article>
            ))
          )}
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-slate-600">
        <span>
          {filtered.length === 0
            ? "Sin resultados"
            : `Mostrando ${from}–${to} de ${filtered.length} alumnos`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 1}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
