const express = require("express");

const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();

const ALLOWED_TIPOS = new Set(["alumno", "materia", "examen"]);

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parsePositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function extractNotaValue(parsedResult) {
  if (parsedResult == null) {
    return null;
  }

  if (Array.isArray(parsedResult)) {
    for (const item of parsedResult) {
      const nota = extractNotaValue(item);
      if (nota !== null) {
        return nota;
      }
    }
    return null;
  }

  if (typeof parsedResult === "object") {
    if (typeof parsedResult.Nota === "number") {
      return parsedResult.Nota;
    }

    if (typeof parsedResult.nota === "number") {
      return parsedResult.nota;
    }
  }

  return null;
}

function buildHistoryWhereClause({ role, userId, tipo }) {
  const where = [];
  const params = [];

  if (!["admin", "coordinador"].includes(role)) {
    where.push("pl.user_id = ?");
    params.push(userId);
  }

  if (tipo) {
    where.push("pl.tipo = ?");
    params.push(tipo);
  }

  return {
    whereSql: where.length > 0 ? `WHERE ${where.join(" AND ")}` : "",
    params,
  };
}

router.get("/", authenticate, async (req, res) => {
  try {
    const { tipo } = req.query;
    const limit = Math.min(parsePositiveInt(req.query.limit, 50), 200);
    const offset = parsePositiveInt(req.query.offset, 0);

    if (tipo && !ALLOWED_TIPOS.has(tipo)) {
      return res.status(400).json({ error: "Parámetro tipo inválido" });
    }

    const { whereSql, params } = buildHistoryWhereClause({
      role: req.user.role,
      userId: req.user.id,
      tipo,
    });

    const dataQuery = `
      SELECT pl.id, pl.user_id, pl.tipo, pl.input_data, pl.result_data, pl.created_at, u.username
      FROM predictions_log pl
      LEFT JOIN users u ON u.id = pl.user_id
      ${whereSql}
      ORDER BY pl.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const totalQuery = `
      SELECT COUNT(*) AS total
      FROM predictions_log pl
      ${whereSql}
    `;

    const rows = db.prepare(dataQuery).all(...params, limit, offset);
    const totalRow = db.prepare(totalQuery).get(...params);

    const data = rows.map((row) => ({
      ...row,
      input_data: safeJsonParse(row.input_data),
      result_data: safeJsonParse(row.result_data),
    }));

    return res.json({
      data,
      total: totalRow?.total ?? 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("Error al obtener historial:", error);
    return res
      .status(500)
      .json({ error: "No se pudo obtener el historial de predicciones." });
  }
});

router.get(
  "/stats",
  authenticate,
  authorize("admin", "coordinador"),
  async (req, res) => {
    try {
      const totalPredicciones =
        db.prepare("SELECT COUNT(*) AS total FROM predictions_log").get()
          ?.total ?? 0;

      const countsByTipo = db
        .prepare(
          `
          SELECT tipo, COUNT(*) AS total
          FROM predictions_log
          GROUP BY tipo
        `,
        )
        .all();

      const por_tipo = { alumno: 0, materia: 0, examen: 0 };
      for (const row of countsByTipo) {
        if (ALLOWED_TIPOS.has(row.tipo)) {
          por_tipo[row.tipo] = row.total;
        }
      }

      const alumnosEnRiesgo =
        db
          .prepare(
            `
            SELECT COUNT(*) AS total
            FROM predictions_log
            WHERE tipo = 'alumno' AND result_data LIKE '%"Abandona":true%'
          `,
          )
          .get()?.total ?? 0;

      const recursadoTrue =
        db
          .prepare(
            `
            SELECT COUNT(*) AS total
            FROM predictions_log
            WHERE tipo = 'materia' AND result_data LIKE '%"Recursa":true%'
          `,
          )
          .get()?.total ?? 0;

      const totalMateria =
        db
          .prepare(
            `
            SELECT COUNT(*) AS total
            FROM predictions_log
            WHERE tipo = 'materia'
          `,
          )
          .get()?.total ?? 0;

      const tasaRecursado =
        totalMateria > 0
          ? Number(((recursadoTrue / totalMateria) * 100).toFixed(2))
          : 0;

      const examRows = db
        .prepare(
          `
          SELECT result_data
          FROM predictions_log
          WHERE tipo = 'examen'
        `,
        )
        .all();

      const notas = examRows
        .map((row) => safeJsonParse(row.result_data))
        .map((result) => extractNotaValue(result))
        .filter((nota) => typeof nota === "number");

      const notaPromedio =
        notas.length > 0
          ? Number(
              (
                notas.reduce((acc, nota) => acc + nota, 0) / notas.length
              ).toFixed(2),
            )
          : 0;

      const prediccionesUltimos7Dias =
        db
          .prepare(
            `
            SELECT COUNT(*) AS total
            FROM predictions_log
            WHERE datetime(created_at) >= datetime('now', '-7 days')
          `,
          )
          .get()?.total ?? 0;

      return res.json({
        total_predicciones: totalPredicciones,
        por_tipo,
        alumnos_en_riesgo: alumnosEnRiesgo,
        tasa_recursado: tasaRecursado,
        nota_promedio: notaPromedio,
        predicciones_ultimos_7_dias: prediccionesUltimos7Dias,
      });
    } catch (error) {
      console.error("Error al obtener estadísticas de historial:", error);
      return res
        .status(500)
        .json({ error: "No se pudieron obtener las estadísticas." });
    }
  },
);

router.get("/:id", authenticate, async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, -1);
    if (id < 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const row = db
      .prepare(
        `
          SELECT pl.id, pl.user_id, pl.tipo, pl.input_data, pl.result_data, pl.created_at, u.username
          FROM predictions_log pl
          LEFT JOIN users u ON u.id = pl.user_id
          WHERE pl.id = ?
        `,
      )
      .get(id);

    if (!row) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    const isGlobalRole = ["admin", "coordinador"].includes(req.user.role);
    if (!isGlobalRole && row.user_id !== req.user.id) {
      return res
        .status(403)
        .json({ error: "Sin permisos para ver este registro" });
    }

    return res.json({
      ...row,
      input_data: safeJsonParse(row.input_data),
      result_data: safeJsonParse(row.result_data),
    });
  } catch (error) {
    console.error("Error al obtener detalle de historial:", error);
    return res.status(500).json({ error: "No se pudo obtener el registro." });
  }
});

router.delete("/:id", authenticate, authorize("admin"), async (req, res) => {
  try {
    const id = parsePositiveInt(req.params.id, -1);
    if (id < 0) {
      return res.status(400).json({ error: "ID inválido" });
    }

    const result = db
      .prepare("DELETE FROM predictions_log WHERE id = ?")
      .run(id);
    if (result.changes === 0) {
      return res.status(404).json({ error: "Registro no encontrado" });
    }

    return res.status(204).send();
  } catch (error) {
    console.error("Error al eliminar registro de historial:", error);
    return res.status(500).json({ error: "No se pudo eliminar el registro." });
  }
});

module.exports = router;
