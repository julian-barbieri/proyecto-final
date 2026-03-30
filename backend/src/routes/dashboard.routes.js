const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");
const {
  calcularVariablesAbandono,
} = require("../services/prediction-variables.service");
const axios = require("axios");

const router = express.Router();

router.use(authorize("admin", "coordinador"));

const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

async function obtenerPrediccionesAbandono(alumnosActivos) {
  const predicciones = [];
  const loteSize = 5;
  let aiDisponible = true;

  for (let i = 0; i < alumnosActivos.length; i += loteSize) {
    const lote = alumnosActivos.slice(i, i + loteSize);
    const promesas = lote.map(async (alumno) => {
      try {
        const vars = calcularVariablesAbandono(alumno.id);
        const body = { ...vars };
        delete body._meta;

        // Aplicar el quirk de PromedioColegio_x/_y
        if (!body.PromedioColegio_x && body.PromedioColegio) {
          body.PromedioColegio_x = body.PromedioColegio;
          body.PromedioColegio_y = body.PromedioColegio;
          delete body.PromedioColegio;
        }

        const resp = await axios.post(`${AI_URL}/predict/alumno`, [body], {
          timeout: 5000,
        });
        const resultado = resp.data[0];

        return {
          id: alumno.id,
          nombre: alumno.nombre_completo,
          veces_cursada: alumno.veces_cursada,
          asistencia: alumno.ultima_asistencia,
          abandona: resultado.Abandona,
          probabilidad: resultado.probabilidad,
          nivel_riesgo:
            resultado.probabilidad >= 0.6
              ? "alto"
              : resultado.probabilidad >= 0.3
                ? "medio"
                : "bajo",
        };
      } catch (err) {
        console.error(
          `Error prediciendo abandono para alumno ${alumno.id}:`,
          err.message,
        );
        aiDisponible = false;
        return {
          id: alumno.id,
          nombre: alumno.nombre_completo,
          veces_cursada: alumno.veces_cursada,
          asistencia: alumno.ultima_asistencia,
          abandona: null,
          probabilidad: null,
          nivel_riesgo: "sin_datos",
        };
      }
    });

    const resultados = await Promise.all(promesas);
    predicciones.push(...resultados);
  }

  return { predicciones, aiDisponible };
}

router.get("/", async (req, res) => {
  try {
    // ──────── PASO 1: Métricas base desde SQLite ────────
    const totalAlumnos = db
      .prepare("SELECT COUNT(*) AS cnt FROM users WHERE role='alumno'")
      .get().cnt;

    const cursandoAhora = db
      .prepare(
        `SELECT COUNT(DISTINCT alumno_id) AS cnt FROM cursadas WHERE estado='cursando'`,
      )
      .get().cnt;

    const cursadasTotales = db
      .prepare("SELECT COUNT(*) AS cnt FROM cursadas")
      .get().cnt;
    const cursadasRecursadas = db
      .prepare("SELECT COUNT(*) AS cnt FROM cursadas WHERE estado='recursada'")
      .get().cnt;
    const tasaRecursadoGlobal =
      cursadasTotales > 0
        ? ((cursadasRecursadas / cursadasTotales) * 100).toFixed(1)
        : 0;

    const promedioNotasGlobal =
      db
        .prepare(
          `SELECT ROUND(AVG(nota), 2) AS prom FROM examenes WHERE rendido=1 AND nota IS NOT NULL`,
        )
        .get().prom || 0;

    const asistenciaBaja = db
      .prepare(
        `SELECT COUNT(DISTINCT c.alumno_id) AS cnt FROM cursadas c WHERE c.estado='cursando' AND c.asistencia < 0.75`,
      )
      .get().cnt;

    // Alumnos cursando AM2 que NO tienen final AM1 aprobado → finales bloqueados
    const am1Id = db
      .prepare("SELECT id FROM materias WHERE codigo='AM1'")
      .get()?.id;
    const am2Id = db
      .prepare("SELECT id FROM materias WHERE codigo='AM2'")
      .get()?.id;

    const finalesAM2Bloqueados =
      am1Id && am2Id
        ? db
            .prepare(
              `
        SELECT COUNT(DISTINCT c.alumno_id) AS cnt
        FROM cursadas c
        WHERE c.materia_id = ? AND c.estado = 'cursando'
          AND NOT EXISTS (
            SELECT 1 FROM examenes e
            WHERE e.alumno_id = c.alumno_id
              AND e.materia_id = ?
              AND e.tipo = 'Final'
              AND e.nota >= 4
              AND e.rendido = 1
          )
        `,
            )
            .get(am2Id, am1Id)?.cnt || 0
        : 0;

    // Tasa de recursado por materia
    const tasaRecursadoPorMateria = db
      .prepare(
        `
        SELECT m.id, m.codigo, m.nombre,
          COUNT(c.id) AS total_cursadas,
          SUM(CASE WHEN c.estado='recursada' THEN 1 ELSE 0 END) AS recursadas,
          ROUND(SUM(CASE WHEN c.estado='recursada' THEN 1.0 ELSE 0 END) / COUNT(c.id) * 100, 1) AS tasa_pct
        FROM materias m
        LEFT JOIN cursadas c ON c.materia_id = m.id
        GROUP BY m.id
      `,
      )
      .all();

    // Distribución de veces cursada por materia
    const distribucionPorMateria =
      db
        .prepare(
          `
        SELECT m.codigo, m.nombre,
          COUNT(CASE WHEN veces = 1 THEN 1 END) AS primera_vez,
          COUNT(CASE WHEN veces = 2 THEN 1 END) AS segunda_vez,
          COUNT(CASE WHEN veces >= 3 THEN 1 END) AS tercera_vez_o_mas
        FROM (
          SELECT c.materia_id, c.alumno_id, COUNT(*) AS veces
          FROM cursadas c
          GROUP BY c.materia_id, c.alumno_id
        ) sub
        JOIN materias m ON sub.materia_id = m.id
        GROUP BY sub.materia_id
      `,
        )
        .all() || [];

    // Últimas predicciones guardadas en log
    const ultimasPredicciones = db
      .prepare(
        `
        SELECT pl.tipo, pl.created_at,
          u.nombre_completo AS alumno_nombre,
          pl.result_data
        FROM predictions_log pl
        JOIN users u ON pl.user_id = u.id
        ORDER BY pl.created_at DESC LIMIT 5
      `,
      )
      .all()
      .map((p) => ({
        ...p,
        result_data: (() => {
          try {
            return JSON.parse(p.result_data);
          } catch {
            return {};
          }
        })(),
      }));

    // ──────── PASO 2: Predicciones ML masivas de abandono ────────
    const alumnosActivos = db
      .prepare(
        `
        SELECT
          u.id,
          u.nombre_completo,
          COUNT(c.id) AS veces_cursada,
          MAX(c.asistencia) AS ultima_asistencia
        FROM users u
        LEFT JOIN cursadas c ON c.alumno_id = u.id
        WHERE u.role = 'alumno'
        GROUP BY u.id
      `,
      )
      .all();

    let prediccionesAbandono = [];
    let aiDisponible = true;

    if (alumnosActivos.length > 0) {
      const resultado = await obtenerPrediccionesAbandono(alumnosActivos);
      prediccionesAbandono = resultado.predicciones;
      aiDisponible = resultado.aiDisponible;
    }

    // Métricas derivadas de predicciones
    const enRiesgoAlto = prediccionesAbandono.filter(
      (p) => p.nivel_riesgo === "alto",
    ).length;
    const enRiesgoMedio = prediccionesAbandono.filter(
      (p) => p.nivel_riesgo === "medio",
    ).length;
    const sinRiesgo = prediccionesAbandono.filter(
      (p) => p.nivel_riesgo === "bajo",
    ).length;

    const tasaRiesgoAlto =
      alumnosActivos.length > 0
        ? ((enRiesgoAlto / alumnosActivos.length) * 100).toFixed(1)
        : 0;

    // Top 5 alumnos con mayor riesgo
    const alertasAbandono = prediccionesAbandono
      .filter((p) => p.probabilidad !== null)
      .sort((a, b) => b.probabilidad - a.probabilidad)
      .slice(0, 5);

    // ──────── PASO 3: Armar respuesta ────────
    res.json({
      kpis: {
        total_alumnos: totalAlumnos,
        cursando_ahora: cursandoAhora,
        tasa_recursado_global: parseFloat(tasaRecursadoGlobal),
        promedio_notas_global: parseFloat(promedioNotasGlobal),
        alumnos_asistencia_baja: asistenciaBaja,
        finales_am2_bloqueados: finalesAM2Bloqueados,
      },
      abandono: {
        en_riesgo_alto: enRiesgoAlto,
        en_riesgo_medio: enRiesgoMedio,
        sin_riesgo: sinRiesgo,
        tasa_riesgo_alto_pct: parseFloat(tasaRiesgoAlto),
        distribucion: prediccionesAbandono,
      },
      por_materia: tasaRecursadoPorMateria,
      distribucion_por_materia: distribucionPorMateria,
      alertas: alertasAbandono,
      actividad_reciente: ultimasPredicciones,
      ai_disponible: aiDisponible,
      calculado_en: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error en /api/dashboard:", error);
    res.status(500).json({
      error: "Error al cargar el dashboard",
      details: error.message,
    });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// ENDPOINT CDU015 - Rendimiento por examen
// ═════════════════════════════════════════════════════════════════════════════
router.get("/rendimiento", (req, res) => {
  try {
    const anio = parseInt(req.query.anio);
    if (!anio || isNaN(anio)) {
      return res
        .status(422)
        .json({ error: "El parámetro anio es requerido." });
    }

    // ── Años disponibles (para el selector) ───────────────────────────────
    const aniosDisponibles = db
      .prepare("SELECT DISTINCT anio FROM examenes ORDER BY anio DESC")
      .all()
      .map((r) => r.anio);

    // ── Estadísticas por materia → tipo → instancia ───────────────────────
    const stats = db
      .prepare(
        `
      SELECT
        m.id            AS materia_id,
        m.codigo        AS materia_codigo,
        m.nombre        AS materia_nombre,
        e.tipo,
        e.instancia,
        COUNT(*)                                                      AS total_intentos,
        SUM(CASE WHEN e.rendido = 1 THEN 1 ELSE 0 END)               AS total_rendidos,
        SUM(CASE WHEN e.ausente  = 1 THEN 1 ELSE 0 END)              AS total_ausentes,
        SUM(CASE WHEN e.rendido = 1 AND e.nota >= 4 THEN 1 ELSE 0 END) AS total_aprobados,
        SUM(CASE WHEN e.rendido = 1 AND e.nota <  4 THEN 1 ELSE 0 END) AS total_desaprobados,
        ROUND(AVG(CASE WHEN e.rendido = 1 AND e.nota IS NOT NULL THEN e.nota END), 2) AS promedio_nota
      FROM examenes e
      JOIN materias m ON e.materia_id = m.id
      JOIN users    u ON e.alumno_id  = u.id
      WHERE e.anio = ? AND u.role = 'alumno'
      GROUP BY m.id, e.tipo, e.instancia
      ORDER BY m.codigo ASC,
        CASE e.tipo
          WHEN 'Parcial'       THEN 1
          WHEN 'Recuperatorio' THEN 2
          WHEN 'Final'         THEN 3
        END,
        e.instancia ASC
    `,
      )
      .all(anio);

    // ── Calcular porcentajes y armar estructura por materia ───────────────
    const porMateria = {};

    for (const row of stats) {
      if (!porMateria[row.materia_id]) {
        porMateria[row.materia_id] = {
          materia_id: row.materia_id,
          materia_codigo: row.materia_codigo,
          materia_nombre: row.materia_nombre,
          examenes: [],
        };
      }

      const totalBase = row.total_intentos; // base para calcular % (incluye ausentes)
      const totalRendidos = row.total_rendidos;

      porMateria[row.materia_id].examenes.push({
        // Identificador legible del examen
        label: `${row.tipo} ${row.instancia}`,
        tipo: row.tipo,
        instancia: row.instancia,
        // Cantidades absolutas
        total_intentos: row.total_intentos,
        total_rendidos: totalRendidos,
        total_ausentes: row.total_ausentes,
        total_aprobados: row.total_aprobados,
        total_desaprobados: row.total_desaprobados,
        promedio_nota: row.promedio_nota ?? 0,
        // Porcentajes sobre total de intentos
        pct_aprobados:
          totalBase > 0
            ? parseFloat(((row.total_aprobados / totalBase) * 100).toFixed(1))
            : 0,
        pct_desaprobados:
          totalBase > 0
            ? parseFloat(
                ((row.total_desaprobados / totalBase) * 100).toFixed(1),
              )
            : 0,
        pct_ausentes:
          totalBase > 0
            ? parseFloat(((row.total_ausentes / totalBase) * 100).toFixed(1))
            : 0,
      });
    }

    res.json({
      anio,
      anios_disponibles: aniosDisponibles,
      por_materia: Object.values(porMateria),
    });
  } catch (error) {
    console.error("Error en /api/dashboard/rendimiento:", error);
    res.status(500).json({
      error: "Error al cargar el rendimiento",
      details: error.message,
    });
  }
});

module.exports = router;
