import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";

export default function GraficoHistoricoMateria({ materiaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const lineChartRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => {
    if (!materiaId) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/api/dashboard/historico?materia_id=${materiaId}`);
        if (!cancelled) setData(resp.data);
      } catch (err) {
        console.error("Error cargando histórico de materia:", err);
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, [materiaId]);

  useEffect(() => {
    if (!data || !window.Chart) return;
    const cursadas = data.por_anio_cursadas;
    if (!cursadas || cursadas.length < 2) return;

    const anios = cursadas.map((d) => d.anio);

    if (lineChartRef.current) lineChartRef.current.destroy();
    if (lineRef.current) {
      lineChartRef.current = new window.Chart(lineRef.current, {
        type: "line",
        data: {
          labels: anios,
          datasets: [{
            label: "Tasa de recursado (%)",
            data: cursadas.map((d) => d.tasa_pct),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239,68,68,0.08)",
            fill: true,
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 13 } } },
            y: {
              min: 0,
              max: 100,
              ticks: { callback: (v) => v + "%", font: { size: 13 } },
              grid: { color: "#f3f4f6" },
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (item) => ` Recursado: ${item.raw}%`,
                afterBody: (items) => {
                  const d = cursadas[items[0].dataIndex];
                  return [`Total cursadas: ${d.total_cursadas}`, `Recursadas: ${d.recursadas}`];
                },
              },
            },
          },
        },
      });
    }

    if (barChartRef.current) barChartRef.current.destroy();
    if (barRef.current) {
      barChartRef.current = new window.Chart(barRef.current, {
        type: "bar",
        data: {
          labels: anios,
          datasets: [
            { label: "1ra vez", data: cursadas.map((d) => d.primera_vez), backgroundColor: "#22c55e" },
            { label: "2da vez", data: cursadas.map((d) => d.segunda_vez), backgroundColor: "#f59e0b" },
            { label: "3ra vez+", data: cursadas.map((d) => d.tercera_vez_o_mas), backgroundColor: "#ef4444" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            x: { grid: { display: false }, ticks: { font: { size: 13 } } },
            y: {
              ticks: { font: { size: 13 }, stepSize: 1 },
              grid: { color: "#f3f4f6" },
            },
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: { font: { size: 13 }, boxWidth: 12, padding: 10 },
            },
            tooltip: {
              callbacks: {
                label: (item) => ` ${item.dataset.label}: ${item.raw} alumnos`,
              },
            },
          },
        },
      });
    }

    return () => {
      if (lineChartRef.current) lineChartRef.current.destroy();
      if (barChartRef.current) barChartRef.current.destroy();
    };
  }, [data]);

  if (loading) {
    return (
      <div className="mt-4 flex justify-center py-6">
        <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const cursadas = data.por_anio_cursadas;
  if (!cursadas || cursadas.length < 2) {
    return (
      <p className="mt-4 text-center text-xs text-gray-400 py-4 border-t border-gray-100">
        Se necesitan al menos 2 años de datos para mostrar la evolución histórica.
      </p>
    );
  }

  return (
    <div className="mt-5 pt-5 border-t border-gray-100 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Evolución histórica
      </p>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">Tasa de recursado por año</p>
          <div style={{ height: "240px", position: "relative" }}>
            <canvas ref={lineRef} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">Distribución por intentos por año</p>
          <div style={{ height: "240px", position: "relative" }}>
            <canvas ref={barRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
