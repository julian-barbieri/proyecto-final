import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";

const TIPOS = [
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "video", label: "Video" },
  { value: "imagen", label: "Imagen" },
  { value: "texto", label: "Texto" },
];

const DESTINATARIOS = [
  { value: "todos", label: "Todos" },
  { value: "individual", label: "Individual" },
];

const FILE_ACCEPT = {
  pdf: ".pdf",
  word: ".doc,.docx",
  imagen: ".jpg,.jpeg,.png,.gif",
};

export default function ContenidoDocente() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [materias, setMaterias] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [misContenidos, setMisContenidos] = useState([]);

  const [form, setForm] = useState({
    titulo: "",
    descripcion: "",
    tipo: "pdf",
    materia_id: "",
    destinatario: "todos",
    alumno_id: "",
    video_url: "",
    texto_contenido: "",
  });
  const [archivo, setArchivo] = useState(null);

  const requiresFile = useMemo(
    () => ["pdf", "word", "imagen"].includes(form.tipo),
    [form.tipo],
  );

  const fetchMisContenidos = async () => {
    const response = await api.get("/api/contenido/tutor/mis-contenidos");
    setMisContenidos(response.data || []);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError("");

      try {
        const [materiasRes, alumnosRes, contenidosRes] = await Promise.all([
          api.get("/api/contenido/tutor/materias"),
          api.get("/api/contenido/tutor/alumnos"),
          api.get("/api/contenido/tutor/mis-contenidos"),
        ]);

        const fetchedMaterias = materiasRes.data || [];
        setMaterias(fetchedMaterias);
        setAlumnos(alumnosRes.data || []);
        setMisContenidos(contenidosRes.data || []);

        if (fetchedMaterias.length > 0) {
          setForm((prev) => ({
            ...prev,
            materia_id: String(fetchedMaterias[0].id),
          }));
        }
      } catch (fetchError) {
        setError(fetchError.message || "No se pudieron cargar los datos.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setSuccess("");
    setError("");

    setForm((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "tipo") {
        next.video_url = "";
        next.texto_contenido = "";
        setArchivo(null);
      }

      if (name === "destinatario" && value === "todos") {
        next.alumno_id = "";
      }

      return next;
    });
  };

  const resetForm = () => {
    setForm((prev) => ({
      titulo: "",
      descripcion: "",
      tipo: "pdf",
      materia_id: prev.materia_id,
      destinatario: "todos",
      alumno_id: "",
      video_url: "",
      texto_contenido: "",
    }));
    setArchivo(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const payload = new FormData();

      payload.append("titulo", form.titulo.trim());
      payload.append("descripcion", form.descripcion.trim());
      payload.append("tipo", form.tipo);
      payload.append("materia_id", form.materia_id);
      payload.append("destinatario", form.destinatario);

      if (form.destinatario === "individual") {
        payload.append("alumno_id", form.alumno_id);
      }

      if (form.tipo === "video") {
        payload.append("video_url", form.video_url.trim());
      }

      if (form.tipo === "texto") {
        payload.append("texto_contenido", form.texto_contenido.trim());
      }

      if (requiresFile && archivo) {
        payload.append("archivo", archivo);
      }

      await api.post("/api/contenido", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await fetchMisContenidos();
      setSuccess("Contenido publicado correctamente.");
      resetForm();
    } catch (submitError) {
      setError(submitError.message || "No se pudo publicar el contenido.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (contenidoId) => {
    setError("");
    setSuccess("");
    setDeletingId(contenidoId);

    try {
      await api.delete(`/api/contenido/${contenidoId}`);
      await fetchMisContenidos();
      setSuccess("Contenido eliminado correctamente.");
    } catch (deleteError) {
      setError(deleteError.message || "No se pudo eliminar el contenido.");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (value) => {
    if (!value) {
      return "-";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  if (loading) {
    return <LoadingSpinner size="md" text="Cargando formulario..." />;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {success ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800">
          {success}
        </div>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="titulo"
            >
              Título
            </label>
            <input
              id="titulo"
              name="titulo"
              value={form.titulo}
              onChange={handleChange}
              required
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label
              className="mb-1 block text-sm font-medium text-slate-700"
              htmlFor="descripcion"
            >
              Descripción
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="tipo"
              >
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                value={form.tipo}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {TIPOS.map((tipo) => (
                  <option key={tipo.value} value={tipo.value}>
                    {tipo.label}
                  </option>
                ))}
              </select>
            </div>

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
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {materias.map((materia) => (
                  <option key={materia.id} value={materia.id}>
                    {materia.codigo} - {materia.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="destinatario"
              >
                Destinatario
              </label>
              <select
                id="destinatario"
                name="destinatario"
                value={form.destinatario}
                onChange={handleChange}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {DESTINATARIOS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {form.destinatario === "individual" ? (
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
                  required
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Seleccioná un alumno</option>
                  {alumnos.map((alumno) => (
                    <option key={alumno.id} value={alumno.id}>
                      {alumno.nombre}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {form.tipo === "video" ? (
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="video_url"
              >
                URL de video
              </label>
              <input
                id="video_url"
                name="video_url"
                value={form.video_url}
                onChange={handleChange}
                required
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ) : null}

          {form.tipo === "texto" ? (
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="texto_contenido"
              >
                Contenido de texto
              </label>
              <textarea
                id="texto_contenido"
                name="texto_contenido"
                value={form.texto_contenido}
                onChange={handleChange}
                required
                rows={8}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          ) : null}

          {requiresFile ? (
            <div>
              <label
                className="mb-1 block text-sm font-medium text-slate-700"
                htmlFor="archivo"
              >
                Archivo
              </label>
              <input
                id="archivo"
                name="archivo"
                type="file"
                required
                accept={FILE_ACCEPT[form.tipo]}
                onChange={(event) =>
                  setArchivo(event.target.files?.[0] || null)
                }
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm"
              />
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || materias.length === 0}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Publicando..." : "Publicar contenido"}
          </button>
        </form>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Mis contenidos
        </h2>

        {misContenidos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Aún no publicaste contenidos.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Materia</th>
                  <th className="px-3 py-2">Destinatario</th>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {misContenidos.map((item) => (
                  <tr key={item.id}>
                    <td className="px-3 py-2 font-medium text-slate-800">
                      {item.titulo}
                    </td>
                    <td className="px-3 py-2 capitalize text-slate-600">
                      {item.tipo}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.materia_nombre}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {item.alumno_id
                        ? item.alumno_nombre || "Individual"
                        : "Todos"}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id)}
                        disabled={deletingId === item.id}
                        className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deletingId === item.id ? "Eliminando..." : "Eliminar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
