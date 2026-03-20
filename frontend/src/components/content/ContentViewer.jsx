import { useMemo, useState } from "react";
import ErrorMessage from "../ErrorMessage";

function toEmbedUrl(url) {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace("www.", "").toLowerCase();

    if (host === "youtube.com") {
      const videoId = parsed.searchParams.get("v");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace("/", "");
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (host === "vimeo.com") {
      const match = parsed.pathname.match(/^\/([0-9]+)$/);
      return match ? `https://player.vimeo.com/video/${match[1]}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export default function ContentViewer({
  item,
  onClose,
  loading = false,
  error = "",
  onRetry,
}) {
  const [fileLoadError, setFileLoadError] = useState("");
  const embedUrl = useMemo(
    () => toEmbedUrl(item?.video_url),
    [item?.video_url],
  );

  const showNotAvailableError =
    ["pdf", "word", "imagen"].includes(item?.tipo) && !item?.archivo_url;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70">
      <div className="h-full w-full overflow-y-auto rounded-none bg-white p-4 sm:mx-auto sm:my-10 sm:h-auto sm:max-h-[90vh] sm:w-[92vw] sm:max-w-6xl sm:rounded-xl">
        <header className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {item?.titulo || "Contenido"}
            </h2>
            <p className="text-sm text-slate-500">
              Tutor: {item?.tutor_nombre || "Tutor"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="Cerrar visor"
          >
            ✕
          </button>
        </header>

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center text-slate-600">
            Cargando contenido...
          </div>
        ) : null}

        {!loading && error ? (
          <div className="space-y-4">
            <ErrorMessage message={error} />
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Reintentar
              </button>
            ) : null}
          </div>
        ) : null}

        {!loading && !error ? (
          <div className="space-y-4">
            {showNotAvailableError ? (
              <ErrorMessage message="El archivo no está disponible. Contactá a tu tutor." />
            ) : null}

            {item?.tipo === "pdf" && item?.archivo_url ? (
              <>
                <iframe
                  src={item.archivo_url}
                  className="h-full min-h-[70vh] w-full rounded border border-slate-200"
                  title={item.titulo}
                  onError={() =>
                    setFileLoadError(
                      "El archivo no está disponible. Contactá a tu tutor.",
                    )
                  }
                />
                <a
                  href={item.archivo_url}
                  download
                  className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Descargar PDF
                </a>
              </>
            ) : null}

            {item?.tipo === "word" && item?.archivo_url ? (
              <>
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(item.archivo_url)}&embedded=true`}
                  className="min-h-[70vh] w-full rounded border border-slate-200"
                  title={item.titulo}
                  onError={() =>
                    setFileLoadError(
                      "El archivo no está disponible. Contactá a tu tutor.",
                    )
                  }
                />
                <a
                  href={item.archivo_url}
                  download
                  className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Descargar archivo
                </a>
              </>
            ) : null}

            {item?.tipo === "video" ? (
              embedUrl ? (
                <iframe
                  src={embedUrl}
                  className="aspect-video w-full rounded border border-slate-200"
                  title={item.titulo}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="space-y-3">
                  <ErrorMessage message="No se pudo cargar el video. Verificá la URL." />
                  {item?.video_url ? (
                    <a
                      href={item.video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Abrir video original
                    </a>
                  ) : null}
                </div>
              )
            ) : null}

            {item?.tipo === "imagen" && item?.archivo_url ? (
              <>
                <img
                  src={item.archivo_url}
                  alt={item.titulo}
                  className="mx-auto max-h-[75vh] max-w-full rounded border border-slate-200 object-contain"
                  onError={() =>
                    setFileLoadError(
                      "El archivo no está disponible. Contactá a tu tutor.",
                    )
                  }
                />
                <a
                  href={item.archivo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Ver en tamaño completo
                </a>
              </>
            ) : null}

            {item?.tipo === "texto" ? (
              <div className="whitespace-pre-wrap rounded border border-slate-200 p-6 text-slate-700">
                {item?.texto_contenido || "Sin contenido disponible."}
              </div>
            ) : null}

            {fileLoadError ? <ErrorMessage message={fileLoadError} /> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
