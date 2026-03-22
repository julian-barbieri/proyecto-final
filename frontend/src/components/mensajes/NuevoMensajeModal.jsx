import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import ErrorMessage from "../ErrorMessage";
import LoadingSpinner from "../LoadingSpinner";
import { useAuth } from "../../context/AuthContext";

const MAX_ASUNTO = 150;
const MAX_CUERPO = 2000;

function normalizeTutorEntries(entries) {
  const byId = new Map();

  for (const item of entries) {
    const key = Number(item.tutor_id);

    if (!byId.has(key)) {
      byId.set(key, {
        tutor_id: key,
        tutor_nombre: item.tutor_nombre,
      });
    }
  }

  return Array.from(byId.values());
}

export default function NuevoMensajeModal({ onClose, onEnviado }) {
  const { user } = useAuth();
  const isAlumno = user?.role === "alumno";
  const isDocente = user?.role === "docente";

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [materias, setMaterias] = useState([]);
  const [tutoresPorMateria, setTutoresPorMateria] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [unidades, setUnidades] = useState([]);

  const [form, setForm] = useState({
    materia_id: "",
    tutor_id: "",
    alumno_id: "",
    unidad_id: "",
    asunto: "",
    cuerpo: "",
  });

  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError("");

      try {
        if (isAlumno) {
          const tutoresResponse = await api.get(
            "/api/mensajes/datos/tutores-por-materia",
          );
          const raw = tutoresResponse.data || [];
          setTutoresPorMateria(raw);

          const mappedMaterias = raw
            .filter((item) => item.materia_id)
            .reduce((acc, current) => {
              if (!acc.some((m) => m.id === current.materia_id)) {
                acc.push({
                  id: current.materia_id,
                  nombre: current.materia_nombre,
                });
              }
              return acc;
            }, []);

          setMaterias(mappedMaterias);
          setTutores(normalizeTutorEntries(raw));

          if (mappedMaterias.length > 0) {
            const firstMateriaId = String(mappedMaterias[0].id);
            setForm((prev) => ({ ...prev, materia_id: firstMateriaId }));
          }
        }

        if (isDocente) {
          const materiasResponse = await api.get(
            "/api/contenido/tutor/materias",
          );
          const availableMaterias = materiasResponse.data || [];
          setMaterias(availableMaterias);

          if (availableMaterias.length > 0) {
            const firstMateriaId = String(availableMaterias[0].id);
            setForm((prev) => ({ ...prev, materia_id: firstMateriaId }));
          }
        }
      } catch (loadError) {
        setError(
          loadError.message ||
            "No se pudieron cargar los datos del formulario.",
        );
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isAlumno, isDocente]);

  useEffect(() => {
    if (!form.materia_id) {
      return;
    }

    const materiaId = Number(form.materia_id);

    const loadRelatedData = async () => {
      setError("");

      try {
        if (isAlumno) {
          const filtered = tutoresPorMateria.filter(
            (item) => item.materia_id === materiaId || item.materia_id === null,
          );

          const available = normalizeTutorEntries(filtered);
          setTutores(available);
          setForm((prev) => ({
            ...prev,
            tutor_id: available[0] ? String(available[0].tutor_id) : "",
          }));

          const unidadesResponse = await api.get(
            `/api/mensajes/datos/unidades/${materiaId}`,
          );
          setUnidades(unidadesResponse.data || []);
          return;
        }

        if (isDocente) {
          const [alumnosResponse, unidadesResponse] = await Promise.all([
            api.get(`/api/mensajes/datos/alumnos-por-materia/${materiaId}`),
            api.get(`/api/mensajes/datos/unidades/${materiaId}`),
          ]);

          const alumnosData = alumnosResponse.data || [];
          setAlumnos(alumnosData);
          setUnidades(unidadesResponse.data || []);
          setForm((prev) => ({
            ...prev,
            alumno_id: alumnosData[0] ? String(alumnosData[0].id) : "",
          }));
        }
      } catch (loadError) {
        setError(
          loadError.message || "No se pudieron cargar alumnos/unidades.",
        );
      }
    };

    loadRelatedData();
  }, [form.materia_id, isAlumno, isDocente, tutoresPorMateria]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setError("");
    setFieldErrors((prev) => ({ ...prev, [name]: false }));
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const nextErrors = {
      materia_id: !form.materia_id,
      asunto: !form.asunto.trim() || form.asunto.trim().length > MAX_ASUNTO,
      cuerpo: !form.cuerpo.trim() || form.cuerpo.trim().length > MAX_CUERPO,
      tutor_id: isAlumno ? !form.tutor_id : false,
      alumno_id: isDocente ? !form.alumno_id : false,
    };

    setFieldErrors(nextErrors);

    return !Object.values(nextErrors).some(Boolean);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      setError("Revisá los campos obligatorios del formulario.");
      return;
    }

    setSending(true);
    setError("");

    const payloadBase = {
      materia_id: Number(form.materia_id),
      unidad_id: form.unidad_id ? Number(form.unidad_id) : null,
      asunto: form.asunto.trim(),
      cuerpo: form.cuerpo.trim(),
    };

    try {
      const response = isAlumno
        ? await api.post("/api/mensajes", {
            ...payloadBase,
            tutor_id: Number(form.tutor_id),
          })
        : await api.post("/api/mensajes/tutor/nuevo", {
            ...payloadBase,
            alumno_id: Number(form.alumno_id),
          });

      const conversacionId = response?.data?.conversacion_id;
      onEnviado(conversacionId);
      onClose();
    } catch (sendError) {
      setError(sendError.message || "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  };

  const inputClass = (hasError) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-red-500"
        : "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl">
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Nuevo mensaje
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
          >
            ✕
          </button>
        </header>

        <div className="p-5">
          {loading ? (
            <LoadingSpinner size="md" text="Cargando opciones..." />
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              {error ? (
                <ErrorMessage message={error} onDismiss={() => setError("")} />
              ) : null}

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="materia_id"
                >
                  Materia
                </label>
                <select
                  id="materia_id"
                  name="materia_id"
                  value={form.materia_id}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.materia_id)}
                >
                  <option value="">Seleccioná una materia</option>
                  {materias.map((materia) => (
                    <option key={materia.id} value={materia.id}>
                      {materia.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {isAlumno ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="tutor_id"
                  >
                    Destinatario (Tutor)
                  </label>
                  <select
                    id="tutor_id"
                    name="tutor_id"
                    value={form.tutor_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.tutor_id)}
                  >
                    <option value="">Seleccioná un tutor</option>
                    {tutores.map((tutor) => (
                      <option key={tutor.tutor_id} value={tutor.tutor_id}>
                        {tutor.tutor_nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {isDocente ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="alumno_id"
                  >
                    Alumno
                  </label>
                  <select
                    id="alumno_id"
                    name="alumno_id"
                    value={form.alumno_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.alumno_id)}
                  >
                    <option value="">Seleccioná un alumno</option>
                    {alumnos.map((alumno) => (
                      <option key={alumno.id} value={alumno.id}>
                        {alumno.nombre_completo ||
                          alumno.email ||
                          `Alumno ${alumno.id}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="unidad_id"
                >
                  Unidad temática
                </label>
                <select
                  id="unidad_id"
                  name="unidad_id"
                  value={form.unidad_id}
                  onChange={handleChange}
                  className={inputClass(false)}
                >
                  <option value="">Sin unidad específica</option>
                  {unidades.map((unidad) => (
                    <option key={unidad.id} value={unidad.id}>
                      {unidad.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="asunto"
                >
                  Asunto
                </label>
                <input
                  id="asunto"
                  name="asunto"
                  value={form.asunto}
                  maxLength={MAX_ASUNTO}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.asunto)}
                />
              </div>

              <div>
                <label
                  className="mb-1 block text-sm font-medium text-slate-700"
                  htmlFor="cuerpo"
                >
                  Mensaje
                </label>
                <textarea
                  id="cuerpo"
                  name="cuerpo"
                  value={form.cuerpo}
                  maxLength={MAX_CUERPO}
                  rows={6}
                  onChange={handleChange}
                  className={inputClass(fieldErrors.cuerpo)}
                />
              </div>

              <footer className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? "Enviando..." : "Enviar mensaje"}
                </button>
              </footer>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
