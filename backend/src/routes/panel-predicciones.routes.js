const express = require("express");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");
const {
  calcularVariablesAbandono,
} = require("../services/prediction-variables.service");
const {
  precalcularPrediccionesCompletas,
} = require("../services/panel-predicciones.service");

const router = express.Router();

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

router.use(authorize("admin", "coordinador"));

// GET /api/panel-predicciones/materias
router.get("/materias", (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        m.id,
        m.codigo,
        m.nombre,
        (
          SELECT COUNT(DISTINCT u.id)
          FROM users u
          JOIN cursadas c ON c.alumno_id = u.id AND c.materia_id = m.id
          WHERE u.role = 'alumno'
            AND (
              EXISTS (
                SELECT 1
                FROM cursadas cc
                WHERE cc.alumno_id = u.id
                  AND cc.materia_id = m.id
                  AND cc.estado = 'cursando'
              )
              OR (
                EXISTS (
                  SELECT 1
                  FROM cursadas cr
                  WHERE cr.alumno_id = u.id
                    AND cr.materia_id = m.id
                    AND cr.estado = 'recursada'
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM cursadas ca
                  WHERE ca.alumno_id = u.id
                    AND ca.materia_id = m.id
                    AND ca.estado = 'aprobada'
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM cursadas cc2
                  WHERE cc2.alumno_id = u.id
                    AND cc2.materia_id = m.id
                    AND cc2.estado = 'cursando'
                )
              )
              OR (
                EXISTS (
                  SELECT 1
                  FROM cursadas cap
                  WHERE cap.alumno_id = u.id
                    AND cap.materia_id = m.id
                    AND cap.estado = 'aprobada'
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM examenes e
                  WHERE e.alumno_id = u.id
                    AND e.materia_id = m.id
                    AND e.tipo = 'Final'
                    AND e.rendido = 1
                    AND e.nota >= 4
                )
                AND NOT EXISTS (
                  SELECT 1
                  FROM cursadas cc3
                  WHERE cc3.alumno_id = u.id
                    AND cc3.materia_id = m.id
                    AND cc3.estado = 'cursando'
                )
              )
            )
        ) AS total_relevantes
      FROM materias m
      ORDER BY m.id ASC
    `,
    )
    .all();

  return res.status(200).json(rows);
});

// GET /api/panel-predicciones/alumnos/:alumnoId
router.get("/alumnos/:alumnoId", (req, res) => {
  const alumnoId = toPositiveInt(req.params.alumnoId);

  if (!alumnoId) {
    return res.status(400).json({ error: "Alumno inválido." });
  }

  const alumno = db
    .prepare(
      `
      SELECT
        id,
        COALESCE(nombre_completo, username) AS nombre_completo,
        email,
        genero,
        fecha_nac,
        promedio_colegio,
        anio_ingreso
      FROM users
      WHERE id = ? AND role = 'alumno'
      LIMIT 1
    `,
    )
    .get(alumnoId);

  if (!alumno) {
    return res.status(404).json({ error: "Alumno no encontrado." });
  }

  const cursadas = db
    .prepare(
      `
      SELECT
        c.id,
        c.alumno_id,
        c.materia_id,
        c.anio,
        c.asistencia,
        c.estado,
        m.codigo AS materia_codigo,
        m.nombre AS materia_nombre
      FROM cursadas c
      JOIN materias m ON m.id = c.materia_id
      WHERE c.alumno_id = ?
      ORDER BY m.codigo ASC, c.anio DESC
    `,
    )
    .all(alumnoId);

  for (const cursada of cursadas) {
    cursada.examenes = db
      .prepare(
        `
        SELECT tipo, instancia, rendido, nota, ausente, veces_recursada, asistencia, fecha_examen
        FROM examenes
        WHERE alumno_id = ? AND materia_id = ? AND anio = ?
        ORDER BY
          CASE tipo
            WHEN 'Parcial' THEN 1
            WHEN 'Recuperatorio' THEN 2
            WHEN 'Final' THEN 3
            ELSE 4
          END,
          instancia ASC
      `,
      )
      .all(alumnoId, cursada.materia_id, cursada.anio);
  }

  let resumen;

  try {
    const vars = calcularVariablesAbandono(alumnoId);
    resumen = {
      cant_materias: vars.CantMaterias,
      cant_recursa: vars.CantRecursa,
      tasa_recursa: vars.TasaRecursa,
      promedio_asistencia: vars.PromedioAsistencia,
      cant_examenes_rendidos: vars.CantExamenesRendidos,
      promedio_nota: vars.PromedioNota,
      cant_aprobados: vars.CantAprobados,
      tasa_aprobacion: vars.TasaAprobacion,
    };
  } catch {
    resumen = {
      cant_materias: 0,
      cant_recursa: 0,
      tasa_recursa: 0,
      promedio_asistencia: 0,
      cant_examenes_rendidos: 0,
      promedio_nota: 0,
      cant_aprobados: 0,
      tasa_aprobacion: 0,
    };
  }

  return res.status(200).json({
    alumno,
    cursadas,
    resumen,
  });
});

function getCursandoAlumnos(materiaId) {
  return db
    .prepare(
      `
      SELECT DISTINCT
        u.id,
        COALESCE(u.nombre_completo, u.username) AS nombre_completo,
        u.email,
        u.genero,
        u.fecha_nac,
        u.promedio_colegio,
        u.anio_ingreso,
        MAX(c.anio) AS ultimo_anio,
        MAX(c.asistencia) AS ultima_asistencia,
        COUNT(c.id) AS veces_cursada,
        (
          SELECT ROUND(AVG(e.nota), 2)
          FROM examenes e
          WHERE e.alumno_id = u.id
            AND e.materia_id = ?
            AND e.rendido = 1
            AND e.nota IS NOT NULL
        ) AS promedio_nota
      FROM users u
      JOIN cursadas c ON c.alumno_id = u.id AND c.materia_id = ?
      WHERE u.role = 'alumno'
      GROUP BY u.id
      HAVING MAX(CASE WHEN c.estado = 'cursando' THEN 1 ELSE 0 END) = 1
      ORDER BY nombre_completo ASC
    `,
    )
    .all(materiaId, materiaId);
}

// GET /api/panel-predicciones/materias/:materiaId/panel-predicciones
// Soporta ?skipPredicciones=true para carga rápida inicial (solo alumnos, sin predicciones IA)
router.get("/materias/:materiaId/panel-predicciones", async (req, res) => {
  const materiaId = toPositiveInt(req.params.materiaId);

  if (!materiaId) {
    return res.status(400).json({ error: "Materia inválida." });
  }

  const materia = db
    .prepare("SELECT id, codigo, nombre FROM materias WHERE id = ? LIMIT 1")
    .get(materiaId);

  if (!materia) {
    return res.status(404).json({ error: "Materia no encontrada." });
  }

  try {
    const cursando = getCursandoAlumnos(materiaId);
    const skipPredicciones = req.query.skipPredicciones === "true";

    if (skipPredicciones) {
      return res.status(200).json({
        materia,
        cursando,
        resumen: { total: cursando.length },
      });
    }

    const alumnosIds = cursando.map((a) => a.id);
    const predicciones = await precalcularPrediccionesCompletas(alumnosIds, materiaId);

    const cursandoConPredicciones = cursando.map((alumno) => ({
      ...alumno,
      prediccion: predicciones[alumno.id] || {
        abandono: { error: "No calculado" },
        recursado: { error: "No calculado" },
        nota: { error: "No calculado" },
      },
    }));

    return res.status(200).json({
      materia,
      cursando: cursandoConPredicciones,
      resumen: { total: cursando.length },
    });
  } catch (error) {
    console.error("Error en panel-predicciones:", error);
    return res.status(500).json({
      error: "Error al calcular predicciones",
      details: error.message,
    });
  }
});

// GET /api/panel-predicciones/materias/:materiaId/predicciones?page=1&pageSize=10
// Retorna predicciones paginadas para los alumnos cursando (C)
router.get("/materias/:materiaId/predicciones", async (req, res) => {
  const materiaId = toPositiveInt(req.params.materiaId);

  if (!materiaId) {
    return res.status(400).json({ error: "Materia inválida." });
  }

  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 10));

  try {
    const cursando = getCursandoAlumnos(materiaId);
    const total = cursando.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const alumnosPagina = cursando.slice(start, start + pageSize);
    const alumnosIds = alumnosPagina.map((a) => a.id);

    const predicciones = await precalcularPrediccionesCompletas(alumnosIds, materiaId);

    return res.status(200).json({
      predicciones,
      pagination: { page, pageSize, total, totalPages },
    });
  } catch (error) {
    console.error("Error al calcular predicciones:", error);
    return res.status(500).json({
      error: "Error al calcular predicciones",
      details: error.message,
    });
  }
});

module.exports = router;
