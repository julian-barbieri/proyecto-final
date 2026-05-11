import { useEffect, useState } from "react";
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

function normalizeCoordinadorEntries(entries) {
  const byId = new Map();

  for (const item of entries) {
    const key = Number(item.coordinador_id);

    if (!byId.has(key)) {
      byId.set(key, {
        coordinador_id: key,
        coordinador_nombre: item.coordinador_nombre,
      });
    }
  }

  return Array.from(byId.values());
}

function normalizeDocenteEntries(entries) {
  const byId = new Map();

  for (const item of entries) {
    const key = Number(item.docente_id);

    if (!byId.has(key)) {
      byId.set(key, {
        docente_id: key,
        docente_nombre: item.docente_nombre,
      });
    }
  }

  return Array.from(byId.values());
}

function uniqueMaterias(entries) {
  return entries
    .filter((item) => item.materia_id || item.id)
    .reduce((acc, current) => {
      const materiaId = current.materia_id || current.id;
      const materiaNombre = current.materia_nombre || current.nombre;

      if (!acc.some((m) => m.id === materiaId)) {
        acc.push({ id: materiaId, nombre: materiaNombre });
      }

      return acc;
    }, []);
}

export default function NuevoMensajeModal({ onClose, onEnviado }) {
  const { user } = useAuth();
  const isAlumno = user?.role === "alumno";
  const isDocente = user?.role === "docente";
  const isCoordinador = user?.role === "coordinador";

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const [materias, setMaterias] = useState([]);
  const [tutoresPorMateria, setTutoresPorMateria] = useState([]);
  const [coordinadoresPorMateria, setCoordinadoresPorMateria] = useState([]);
  const [docentesPorMateria, setDocentesPorMateria] = useState([]);
  const [tutores, setTutores] = useState([]);
  const [coordinadores, setCoordinadores] = useState([]);
  const [docentes, setDocentes] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [unidades, setUnidades] = useState([]);
  const [docenteDestinoTipo, setDocenteDestinoTipo] = useState("alumno");

  const [form, setForm] = useState({
    materia_id: "",
    destinatario_id: "",
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
          const mappedMaterias = uniqueMaterias(raw);

          setMaterias(mappedMaterias);
          setTutores(normalizeTutorEntries(raw));

          if (mappedMaterias.length > 0) {
            const firstMateriaId = String(mappedMaterias[0].id);
            setForm((prev) => ({ ...prev, materia_id: firstMateriaId }));
          }
        }

        if (isDocente) {
          const [materiasResponse, coordinadoresResponse] = await Promise.all([
            api.get("/api/contenido/tutor/materias"),
            api.get("/api/mensajes/datos/coordinadores-por-materia"),
          ]);

          const availableMaterias = materiasResponse.data || [];
          const coordinadoresRaw = coordinadoresResponse.data || [];

          setCoordinadoresPorMateria(coordinadoresRaw);
          setMaterias(availableMaterias);
          setCoordinadores(normalizeCoordinadorEntries(coordinadoresRaw));

          if (availableMaterias.length > 0) {
            const firstMateriaId = String(availableMaterias[0].id);
            setForm((prev) => ({ ...prev, materia_id: firstMateriaId }));
          }
        }

        if (isCoordinador) {
          const [materiasResponse, docentesResponse] = await Promise.all([
            api.get("/api/gestion/materias-disponibles"),
            api.get("/api/mensajes/datos/docentes-por-materia"),
          ]);

          const materiasRaw = materiasResponse.data || [];
          const docentesRaw = docentesResponse.data || [];

          const availableMaterias = uniqueMaterias(materiasRaw);
          setMaterias(availableMaterias);
          setDocentesPorMateria(docentesRaw);
          setDocentes(normalizeDocenteEntries(docentesRaw));

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
  }, [isAlumno, isDocente, isCoordinador]);

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
            destinatario_id: available[0] ? String(available[0].tutor_id) : "",
          }));
        }

        if (isDocente && docenteDestinoTipo === "alumno") {
          const [alumnosResponse, unidadesResponse] = await Promise.all([
            api.get(`/api/mensajes/datos/alumnos-por-materia/${materiaId}`),
            api.get(`/api/mensajes/datos/unidades/${materiaId}`),
          ]);

          const alumnosData = alumnosResponse.data || [];
          setAlumnos(alumnosData);
          setUnidades(unidadesResponse.data || []);
          setForm((prev) => ({
            ...prev,
            destinatario_id: alumnosData[0] ? String(alumnosData[0].id) : "",
          }));
          return;
        }

        const unidadesResponse = await api.get(
          `/api/mensajes/datos/unidades/${materiaId}`,
        );
        setUnidades(unidadesResponse.data || []);

        if (isDocente && docenteDestinoTipo === "coordinador") {
          const filtered = coordinadoresPorMateria.filter(
            (item) => item.materia_id === materiaId || item.materia_id === null,
          );

          const available = normalizeCoordinadorEntries(filtered);
          setCoordinadores(available);
          setForm((prev) => ({
            ...prev,
            destinatario_id: available[0]
              ? String(available[0].coordinador_id)
              : "",
          }));
          return;
        }

        if (isCoordinador) {
          const filtered = docentesPorMateria.filter(
            (item) => item.materia_id === materiaId || item.materia_id === null,
          );

          const available = normalizeDocenteEntries(filtered);
          setDocentes(available);
          setForm((prev) => ({
            ...prev,
            destinatario_id: available[0]
              ? String(available[0].docente_id)
              : "",
          }));
        }
      } catch (loadError) {
        setError(
          loadError.message || "No se pudieron cargar alumnos/unidades.",
        );
      }
    };

    loadRelatedData();
  }, [
    form.materia_id,
    isAlumno,
    isDocente,
    isCoordinador,
    docenteDestinoTipo,
    tutoresPorMateria,
    coordinadoresPorMateria,
    docentesPorMateria,
  ]);

  useEffect(() => {
    if (!isDocente) {
      return;
    }

    setForm((prev) => ({ ...prev, destinatario_id: "" }));
  }, [docenteDestinoTipo, isDocente]);

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
      destinatario_id: !form.destinatario_id,
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
            tutor_id: Number(form.destinatario_id),
          })
        : isDocente && docenteDestinoTipo === "alumno"
          ? await api.post("/api/mensajes/tutor/nuevo", {
              ...payloadBase,
              alumno_id: Number(form.destinatario_id),
            })
          : await api.post("/api/mensajes/docente-coordinador", {
              ...payloadBase,
              destinatario_id: Number(form.destinatario_id),
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

              {isDocente ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="docente_destino_tipo"
                  >
                    Tipo de conversación
                  </label>
                  <select
                    id="docente_destino_tipo"
                    value={docenteDestinoTipo}
                    onChange={(event) =>
                      setDocenteDestinoTipo(event.target.value)
                    }
                    className={inputClass(false)}
                  >
                    <option value="alumno">Docente ↔ Alumno</option>
                    <option value="coordinador">Docente ↔ Coordinador</option>
                  </select>
                </div>
              ) : null}

              {isAlumno ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="destinatario_id"
                  >
                    Destinatario (Tutor)
                  </label>
                  <select
                    id="destinatario_id"
                    name="destinatario_id"
                    value={form.destinatario_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.destinatario_id)}
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

              {isDocente && docenteDestinoTipo === "alumno" ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="destinatario_id"
                  >
                    Alumno
                  </label>
                  <select
                    id="destinatario_id"
                    name="destinatario_id"
                    value={form.destinatario_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.destinatario_id)}
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

              {isDocente && docenteDestinoTipo === "coordinador" ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="destinatario_id"
                  >
                    Coordinador
                  </label>
                  <select
                    id="destinatario_id"
                    name="destinatario_id"
                    value={form.destinatario_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.destinatario_id)}
                  >
                    <option value="">Seleccioná un coordinador</option>
                    {coordinadores.map((coordinador) => (
                      <option
                        key={coordinador.coordinador_id}
                        value={coordinador.coordinador_id}
                      >
                        {coordinador.coordinador_nombre}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {isCoordinador ? (
                <div>
                  <label
                    className="mb-1 block text-sm font-medium text-slate-700"
                    htmlFor="destinatario_id"
                  >
                    Docente
                  </label>
                  <select
                    id="destinatario_id"
                    name="destinatario_id"
                    value={form.destinatario_id}
                    onChange={handleChange}
                    className={inputClass(fieldErrors.destinatario_id)}
                  >
                    <option value="">Seleccioná un docente</option>
                    {docentes.map((docente) => (
                      <option
                        key={docente.docente_id}
                        value={docente.docente_id}
                      >
                        {docente.docente_nombre}
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
