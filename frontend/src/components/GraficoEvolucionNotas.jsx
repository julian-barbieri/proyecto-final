import { useEffect, useRef } from "react";

function construirSerieNotas(cursadas) {
  const puntos = [];
  const ordenadas = [...cursadas].sort((a, b) =>
    a.anio !== b.anio
      ? a.anio - b.anio
      : a.materia_codigo.localeCompare(b.materia_codigo),
  );

  for (const c of ordenadas) {
    for (const e of c.examenes || []) {
      if (e.rendido === 1 && e.nota !== null) {
        puntos.push({
          label: `${e.tipo.slice(0, 3)}${e.instancia} ${c.materia_codigo} ${c.anio}`,
          nota: e.nota,
          materia: c.materia_codigo,
        });
      }
    }
  }
  return puntos;
}

export default function GraficoEvolucionNotas({ cursadas }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !cursadas?.length) return;
    if (chartRef.current) chartRef.current.destroy();
    if (!window.Chart) return;

    const puntos = construirSerieNotas(cursadas);
    if (puntos.length === 0) return;

    const labels = puntos.map((p) => p.label);
    const notas = puntos.map((p) => p.nota);

    // Color de cada punto según materia
    const coloresPunto = puntos.map(
      (p) => (p.materia === "AM1" ? "#3b82f6" : "#8b5cf6"), // azul=AM1, violeta=AM2
    );

    chartRef.current = new window.Chart(canvasRef.current, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Nota",
            data: notas,
            borderColor: "#6b7280",
            borderWidth: 2,
            pointBackgroundColor: coloresPunto,
            pointBorderColor: coloresPunto,
            pointRadius: 6,
            pointHoverRadius: 8,
            tension: 0.3,
            fill: false,
          },
          // Línea de aprobación en y=4
          {
            label: "Mínimo aprobación",
            data: Array(puntos.length).fill(4),
            borderColor: "#fbbf24",
            borderWidth: 1.5,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { size: 10 }, maxRotation: 45 },
          },
          y: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              font: { size: 11 },
            },
            grid: { color: "#f3f4f6" },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (item) =>
                item.datasetIndex === 0
                  ? ` Nota: ${item.raw} ${item.raw >= 4 ? "✓" : "✗"}`
                  : null,
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [cursadas]);

  const puntos = construirSerieNotas(cursadas || []);
  if (puntos.length === 0) return null;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-700">
          Evolución de notas
        </h3>
        {/* Leyenda de colores por materia */}
        <div className="flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />{" "}
            AM1
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-violet-500 inline-block" />{" "}
            AM2
          </span>
          <span className="flex items-center gap-1">
            <span className="w-6 border-t-2 border-dashed border-amber-400 inline-block" />{" "}
            Mín. aprobación
          </span>
        </div>
      </div>
      <div style={{ position: "relative", height: "220px" }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
