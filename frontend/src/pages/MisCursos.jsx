import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import LoadingSpinner from "../components/LoadingSpinner";
import MateriaCard from "../components/miscursos/MateriaCard";

const TABS = [
  { key: "cursando", label: "Cursando" },
  { key: "finalesPendientes", label: "Finales pendientes" },
  { key: "aprobadas", label: "Aprobadas" },
  { key: "recursadas", label: "Recursadas" },
];

const EMPTY_TAB_STATE = {
  cursando: {
    icon: "📝",
    title: "No estás cursando materias ahora",
    description:
      "Cuando comiences una cursada activa, la vas a ver en esta sección.",
  },
  finalesPendientes: {
    icon: "⏳",
    title: "No tenés finales pendientes",
    description:
      "Las materias con cursada aprobada y final pendiente aparecerán acá.",
  },
  aprobadas: {
    icon: "✅",
    title: "Todavía no tenés materias aprobadas",
    description:
      "Cuando apruebes el final de una materia, se mostrará en esta pestaña.",
  },
  recursadas: {
    icon: "🔁",
    title: "No registrás materias recursadas",
    description:
      "Si recursás una materia, podrás verla aquí para su seguimiento.",
  },
};

export default function MisCursos() {
  const navigate = useNavigate();

  const [data, setData] = useState({
    cursando: [],
    finalesPendientes: [],
    aprobadas: [],
    recursadas: [],
  });
  const [activeTab, setActiveTab] = useState("cursando");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const hasAnyCourse = useMemo(
    () =>
      Object.values(data).some((collection) =>
        Array.isArray(collection) ? collection.length > 0 : false,
      ),
    [data],
  );

  const activeItems = useMemo(() => data[activeTab] || [], [activeTab, data]);

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/api/mis-cursos");
      setData({
        cursando: response.data?.cursando || [],
        finalesPendientes: response.data?.finalesPendientes || [],
        aprobadas: response.data?.aprobadas || [],
        recursadas: response.data?.recursadas || [],
      });
    } catch (fetchError) {
      setError(fetchError.message || "No se pudo cargar Mis cursos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-semibold text-slate-900">Mis cursos</h2>
        <p className="mt-2 text-slate-600">
          Consultá tu situación por materia, finales pendientes y cursadas
          anteriores.
        </p>
      </section>

      {error ? (
        <ErrorMessage message={error} onDismiss={() => setError("")} />
      ) : null}

      {loading ? (
        <LoadingSpinner size="md" text="Cargando tus materias..." />
      ) : null}

      {!loading && !error && !hasAnyCourse ? (
        <EmptyState
          icon="📚"
          title="Aún no tenés historial de cursadas"
          description="Cuando exista actividad académica registrada, vas a verla en Mis cursos."
        />
      ) : null}

      {!loading && !error && hasAnyCourse ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-2 sm:p-4">
            <div
              className="-mx-1 flex gap-2 overflow-x-auto px-1"
              role="tablist"
              aria-label="Estados de materias"
            >
              {TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const count = Array.isArray(data[tab.key])
                  ? data[tab.key].length
                  : 0;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveTab(tab.key)}
                    className={`whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-blue-100 text-blue-700"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>
          </section>

          {activeItems.length === 0 ? (
            <EmptyState
              icon={EMPTY_TAB_STATE[activeTab].icon}
              title={EMPTY_TAB_STATE[activeTab].title}
              description={EMPTY_TAB_STATE[activeTab].description}
            />
          ) : (
            <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {activeItems.map((materia) => (
                <MateriaCard
                  key={materia.materia_id}
                  materia={materia}
                  status={activeTab}
                  onClick={(selected) =>
                    navigate(`/mis-cursos/${selected.materia_id}`)
                  }
                />
              ))}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
