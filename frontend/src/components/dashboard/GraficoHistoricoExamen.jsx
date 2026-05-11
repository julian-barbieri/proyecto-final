import { useEffect, useRef, useState } from "react";
import api from "../../api/axios";

const SERIES_COLORS = [
  "#3b82f6", "#8b5cf6", "#f97316", "#ec4899", "#eab308", "#22c55e", "#6366f1",
];

export default function GraficoHistoricoExamen({ materiaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const aprobRef = useRef(null);
  const promRef = useRef(null);
  const aprobChartRef = useRef(null);
  const promChartRef = useRef(null);

  useEffect(() => {
    if (!materiaId) return;
    let cancelled = false;
    const fetchData = async () => {
      try {
        setLoading(true);
        const resp = await api.get(`/api/dashboard/historico?materia_id=${materiaId}`);
        if (!cancelled) setData(resp.data);
      } catch (err) {
        console.error("Error cargando histórico de exámenes:", err);
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
    const raw = data.por_anio_examenes;
    if (!raw || raw.length === 0) return;

    const anios = [...new Set(raw.map((d) => d.anio))].sort();
    if (anios.length < 2) return;

    const seriesKeys = [...new Set(raw.map((d) => `${d.tipo} ${d.instancia}`))];

    const aprobMap = {};
    const promMap = {};
    seriesKeys.forEach((k) => { aprobMap[k] = {}; promMap[k] = {}; });
    raw.forEach((d) => {
      const k = `${d.tipo} ${d.instancia}`;
      aprobMap[k][d.anio] = d.pct_aprobados ?? null;
      promMap[k][d.anio] = d.promedio_nota ?? null;
    });

    const mkDatasets = (map) =>
      seriesKeys.map((k, i) => ({
        label: k,
        data: anios.map((anio) => map[k][anio] ?? null),
        borderColor: SERIES_COLORS[i % SERIES_COLORS.length],
        backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] + "20",
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6,
        spanGaps: true,
      }));

    const commonOptions = (yMax, fmtTick) => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 13 } } },
        y: {
          min: 0,
          max: yMax,
          ticks: { callback: fmtTick, font: { size: 13 } },
          grid: { color: "#f3f4f6" },
        },
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { font: { size: 13 }, boxWidth: 12, padding: 10 },
        },
      },
    });

    if (aprobChartRef.current) aprobChartRef.current.destroy();
    if (aprobRef.current) {
      aprobChartRef.current = new window.Chart(aprobRef.current, {
        type: "line",
        data: { labels: anios, datasets: mkDatasets(aprobMap) },
        options: commonOptions(100, (v) => v + "%"),
      });
    }

    if (promChartRef.current) promChartRef.current.destroy();
    if (promRef.current) {
      promChartRef.current = new window.Chart(promRef.current, {
        type: "line",
        data: { labels: anios, datasets: mkDatasets(promMap) },
        options: commonOptions(10, (v) => v),
      });
    }

    return () => {
      if (aprobChartRef.current) aprobChartRef.current.destroy();
      if (promChartRef.current) promChartRef.current.destroy();
    };
  }, [data]);

  if (loading) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8 flex justify-center py-8">
        <div className="w-5 h-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const anios = [...new Set((data.por_anio_examenes || []).map((d) => d.anio))];
  if (anios.length < 2) {
    return (
      <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8">
        <p className="text-center text-xs text-gray-400 py-2">
          Se necesitan al menos 2 años de datos para mostrar la evolución histórica.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mb-8 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
        Evolución histórica
      </p>
      <div className="space-y-4">
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">Tasa de aprobación por año (%)</p>
          <div style={{ height: "260px", position: "relative" }}>
            <canvas ref={aprobRef} />
          </div>
        </div>
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
          <p className="text-xs font-medium text-gray-600 mb-3">Promedio de nota por año</p>
          <div style={{ height: "260px", position: "relative" }}>
            <canvas ref={promRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
