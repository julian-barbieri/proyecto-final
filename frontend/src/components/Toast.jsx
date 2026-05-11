import { useEffect, useState } from "react";

export default function Toast({ message, type = "success", onClose }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => setVisible(true), 20);
    const autoClose = window.setTimeout(() => handleClose(), 4000);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(autoClose);
    };
  }, []);

  const handleClose = () => {
    setVisible(false);
    window.setTimeout(() => {
      if (onClose) {
        onClose();
      }
    }, 250);
  };

  const tone =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div
      className={`fixed bottom-4 right-4 z-[80] w-[min(92vw,420px)] rounded-lg border px-4 py-3 shadow-lg transition-all duration-200 ${tone} ${
        visible ? "translate-x-0 opacity-100" : "translate-x-6 opacity-0"
      }`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium">{message}</p>
        <button
          type="button"
          onClick={handleClose}
          className="rounded p-1 text-current hover:bg-black/5"
          aria-label="Cerrar notificación"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
