import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import NuevoMensajeModal from "../components/mensajes/NuevoMensajeModal";
import { useAuth } from "../context/AuthContext";

const MAX_CUERPO = 2000;

const ROLE_LABELS = {
  alumno: "Alumno",
  docente: "Docente",
  coordinador: "Coordinador",
  admin: "Admin",
};

function getTipoConversacionLabel(tipo) {
  return tipo === "docente_coordinador"
    ? "Docente ↔ Coordinador"
    : "Alumno ↔ Tutor";
}

function formatRelativeDate(value) {
  if (!value) {
    return "Sin actividad";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin actividad";
  }

  const diffMs = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / minute));
    return `Hace ${minutes} min`;
  }

  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return `Hace ${hours} h`;
  }

  const days = Math.floor(diffMs / day);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}

function formatMessageTimestamp(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function Mensajes() {
  const { user } = useAuth();
  const mensajesEndRef = useRef(null);

  const [conversaciones, setConversaciones] = useState([]);
  const [seleccionada, setSeleccionada] = useState(null);

  const [loadingLista, setLoadingLista] = useState(true);
  const [loadingHilo, setLoadingHilo] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const [errorLista, setErrorLista] = useState("");
  const [errorHilo, setErrorHilo] = useState("");
  const [errorRespuesta, setErrorRespuesta] = useState("");

  const [respuesta, setRespuesta] = useState("");
  const [mostrarModal, setMostrarModal] = useState(false);
  const [vistaMovil, setVistaMovil] = useState("lista");

  const selectedConversationId = seleccionada?.conversacion?.id;

  const loadConversaciones = async () => {
    setLoadingLista(true);
    setErrorLista("");

    try {
      const response = await api.get("/api/mensajes");
      setConversaciones(response.data || []);
    } catch (loadError) {
      setErrorLista(
        loadError.message || "No se pudo cargar la lista de conversaciones.",
      );
    } finally {
      setLoadingLista(false);
    }
  };

  useEffect(() => {
    loadConversaciones();
  }, []);

  const loadConversationThread = async (conversacionId) => {
    setLoadingHilo(true);
    setErrorHilo("");

    try {
      const response = await api.get(`/api/mensajes/${conversacionId}`);
      const payload = response.data;

      setSeleccionada(payload);
      setConversaciones((prev) =>
        prev.map((item) =>
          item.id === conversacionId
            ? {
                ...item,
                no_leidos: 0,
              }
            : item,
        ),
      );
      setVistaMovil("hilo");
    } catch (loadError) {
      setErrorHilo(loadError.message || "No se pudo cargar el hilo.");
    } finally {
      setLoadingHilo(false);
    }
  };

  const selectedLabel = useMemo(() => {
    if (!seleccionada?.conversacion) {
      return "";
    }

    const currentUserId = Number(user?.id);
    const conversacion = seleccionada.conversacion;

    const isParticipantA =
      Number(conversacion.participante_a_id) === currentUserId;

    const nombre = isParticipantA
      ? conversacion.participante_b_nombre
      : conversacion.participante_a_nombre;

    const role = isParticipantA
      ? conversacion.participante_b_role
      : conversacion.participante_a_role;

    if (!nombre) {
      return "";
    }

    return `${nombre}${role ? ` (${ROLE_LABELS[role] || role})` : ""}`;
  }, [seleccionada, user?.id]);

  useEffect(() => {
    if (seleccionada?.mensajes) {
      mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [seleccionada?.mensajes]);

  const handleSendReply = async () => {
    const text = respuesta.trim();

    if (!selectedConversationId) {
      return;
    }

    if (!text) {
      setErrorRespuesta("Escribí una respuesta antes de enviar.");
      return;
    }

    if (text.length > MAX_CUERPO) {
      setErrorRespuesta("El mensaje no puede superar 2000 caracteres.");
      return;
    }

    setEnviando(true);
    setErrorRespuesta("");

    try {
      const response = await api.post(
        `/api/mensajes/${selectedConversationId}/responder`,
        {
          cuerpo: text,
        },
      );

      const nuevoMensaje = response.data;
      setRespuesta("");
      setSeleccionada((prev) => {
        if (!prev) {
          return prev;
        }

        return {
          ...prev,
          mensajes: [...prev.mensajes, nuevoMensaje],
          conversacion: {
            ...prev.conversacion,
            ultimo_mensaje_at: nuevoMensaje.created_at,
          },
        };
      });

      setConversaciones((prev) => {
        const current = prev.find((item) => item.id === selectedConversationId);
        const updated = prev
          .map((item) =>
            item.id === selectedConversationId
              ? {
                  ...item,
                  ultimo_mensaje_at: nuevoMensaje.created_at,
                }
              : item,
          )
          .sort(
            (a, b) =>
              new Date(b.ultimo_mensaje_at).getTime() -
              new Date(a.ultimo_mensaje_at).getTime(),
          );

        if (!current) {
          return prev;
        }

        return updated;
      });
    } catch (sendError) {
      setErrorRespuesta(sendError.message || "No se pudo enviar la respuesta.");
    } finally {
      setEnviando(false);
    }
  };

  const handleOpenConversation = (conversationId) => {
    if (conversationId === selectedConversationId && seleccionada) {
      setVistaMovil("hilo");
      return;
    }

    loadConversationThread(conversationId);
  };

  const handleConversationCreated = async (conversationId) => {
    await loadConversaciones();

    if (conversationId) {
      await loadConversationThread(conversationId);
    }
  };

  const renderConversationItem = (item) => {
    const isSelected = selectedConversationId === item.id;
    const currentUserId = Number(user?.id);
    const isParticipantA = Number(item.participante_a_id) === currentUserId;
    const counterpart = isParticipantA
      ? item.participante_b_nombre
      : item.participante_a_nombre;
    const tipoConversacionLabel = getTipoConversacionLabel(
      item.tipo_conversacion,
    );

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleOpenConversation(item.id)}
        className={`w-full rounded-lg border p-3 text-left transition ${
          isSelected
            ? "border-blue-200 bg-blue-50"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-start gap-2">
            {item.no_leidos > 0 ? (
              <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-red-500" />
            ) : (
              <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-transparent" />
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800">
                {item.asunto}
              </p>
              <p className="truncate text-xs text-slate-600">
                {counterpart || "Participante"}
              </p>
              <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                {tipoConversacionLabel}
              </p>
              <p className="truncate text-xs text-slate-500">
                {item.materia_nombre}
                {item.unidad_nombre ? ` · ${item.unidad_nombre}` : ""}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-xs text-slate-500">
            {formatRelativeDate(item.ultimo_mensaje_at)}
          </span>
        </div>
      </button>
    );
  };

  const listPanelVisible = vistaMovil === "lista";
  const threadPanelVisible = vistaMovil === "hilo";

  return (
    <div className="space-y-4">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-xl font-semibold text-slate-900">Mensajes</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadConversaciones}
            className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            ↻ Actualizar
          </button>
          <button
            type="button"
            onClick={() => setMostrarModal(true)}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nuevo mensaje
          </button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <aside
          className={`rounded-lg border border-slate-200 bg-white p-3 md:col-span-1 ${
            !listPanelVisible ? "hidden md:block" : "block"
          }`}
        >
          {errorLista ? (
            <ErrorMessage
              message={errorLista}
              onDismiss={() => setErrorLista("")}
            />
          ) : null}

          {loadingLista ? (
            <LoadingSpinner size="md" text="Cargando conversaciones..." />
          ) : conversaciones.length === 0 ? (
            <EmptyState
              icon="✉️"
              title="No tenés mensajes todavía."
              description="Cuando envíes o recibas mensajes, van a aparecer acá."
            />
          ) : (
            <div className="space-y-2">
              {conversaciones.map(renderConversationItem)}
            </div>
          )}
        </aside>

        <div
          className={`rounded-lg border border-slate-200 bg-white p-4 md:col-span-2 ${
            !threadPanelVisible ? "hidden md:block" : "block"
          }`}
        >
          {!seleccionada ? (
            <EmptyState
              icon="📨"
              title="Seleccioná una conversación para leerla."
              description="Elegí un hilo de la lista para ver los mensajes y responder."
            />
          ) : (
            <div className="flex h-full flex-col">
              <header className="mb-3 border-b border-slate-200 pb-3">
                <div className="mb-2 md:hidden">
                  <button
                    type="button"
                    onClick={() => setVistaMovil("lista")}
                    className="text-sm font-medium text-blue-700"
                  >
                    ← Volver
                  </button>
                </div>
                <h3 className="text-base font-semibold text-slate-900">
                  {seleccionada.conversacion.asunto}
                </h3>
                <p className="text-xs text-slate-500">
                  {seleccionada.conversacion.materia_nombre}
                  {seleccionada.conversacion.unidad_nombre
                    ? ` · ${seleccionada.conversacion.unidad_nombre}`
                    : ""}
                  {selectedLabel ? ` · ${selectedLabel}` : ""}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {getTipoConversacionLabel(
                    seleccionada.conversacion.tipo_conversacion,
                  )}
                </p>
              </header>

              {errorHilo ? (
                <div className="mb-3 space-y-2">
                  <ErrorMessage
                    message={errorHilo}
                    onDismiss={() => setErrorHilo("")}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      loadConversationThread(selectedConversationId)
                    }
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    Reintentar
                  </button>
                </div>
              ) : null}

              <div className="mb-3 max-h-[50vh] flex-1 space-y-3 overflow-y-auto pr-1">
                {loadingHilo ? (
                  <LoadingSpinner size="md" text="Cargando hilo..." />
                ) : seleccionada.mensajes.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Sé el primero en escribir en esta conversación.
                  </p>
                ) : (
                  seleccionada.mensajes.map((mensaje) => {
                    const ownMessage = mensaje.remitente_id === user?.id;

                    return (
                      <div
                        key={mensaje.id}
                        className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[80%]">
                          <div
                            className={`rounded-lg px-3 py-2 text-sm ${
                              ownMessage
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {mensaje.cuerpo}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {mensaje.remitente_nombre} ·{" "}
                            {formatMessageTimestamp(mensaje.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={mensajesEndRef} />
              </div>

              <div className="border-t border-slate-200 pt-3">
                {errorRespuesta ? (
                  <ErrorMessage
                    message={errorRespuesta}
                    onDismiss={() => setErrorRespuesta("")}
                  />
                ) : null}

                <textarea
                  value={respuesta}
                  maxLength={MAX_CUERPO}
                  onChange={(event) => {
                    setRespuesta(event.target.value);
                    setErrorRespuesta("");
                  }}
                  placeholder="Escribí tu respuesta..."
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="mt-1 flex items-center justify-between">
                  <span
                    className={`text-xs ${
                      respuesta.length > 1800
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  >
                    {respuesta.length} / {MAX_CUERPO}
                  </span>
                  <button
                    type="button"
                    onClick={handleSendReply}
                    disabled={enviando}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enviando ? "Enviando..." : "Enviar"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {mostrarModal ? (
        <NuevoMensajeModal
          onClose={() => setMostrarModal(false)}
          onEnviado={handleConversationCreated}
        />
      ) : null}
    </div>
  );
}
