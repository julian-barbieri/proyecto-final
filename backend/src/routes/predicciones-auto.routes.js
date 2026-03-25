const express = require("express");
const axios = require("axios");
const db = require("../db/database");
const { authorize } = require("../middleware/auth.middleware");
const {
  calcularVariablesAbandono,
  calcularVariablesRecursado,
  calcularVariablesExamen,
} = require("../services/prediction-variables.service");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

router.use(authorize("admin", "coordinador"));

const insertPredictionLog = db.prepare(
  "INSERT INTO predictions_log (user_id, tipo, input_data, result_data) VALUES (?, ?, ?, ?)",
);

function toPositiveInt(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

function normalizeTipoExamen(value) {
  const valid = ["Parcial", "Recuperatorio", "Final"];
  if (!value || typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return valid.includes(normalized) ? normalized : null;
}

function normalizeAlumnoPayload(payload) {
  return payload.map((item) => {
    if (
      item &&
      Object.prototype.hasOwnProperty.call(item, "PromedioColegio") &&
      !Object.prototype.hasOwnProperty.call(item, "PromedioColegio_x") &&
      !Object.prototype.hasOwnProperty.call(item, "PromedioColegio_y")
    ) {
      const { PromedioColegio, ...rest } = item;
      return {
        ...rest,
        PromedioColegio_x: PromedioColegio,
        PromedioColegio_y: PromedioColegio,
      };
    }

    return item;
  });
}

function handleAiServiceError(error, res) {
  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      error:
        "El servicio de IA no está disponible. Verificá que la FastAPI esté corriendo en :8000.",
    });
  }

  if (error.response) {
    return res
      .status(error.response.status)
      .json(
        typeof error.response.data === "object" && error.response.data !== null
          ? error.response.data
          : { error: error.response.data || "Error del servicio de IA" },
      );
  }

  return res.status(500).json({ error: "Error interno del servidor" });
}

async function callAiPrediction(tipo, payload) {
  const endpointByTipo = {
    alumno: "/predict/alumno",
    materia: "/predict/materia",
    examen: "/predict/examen",
  };

  const body = tipo === "alumno" ? normalizeAlumnoPayload(payload) : payload;
  const response = await axios.post(
    `${AI_SERVICE_URL}${endpointByTipo[tipo]}`,
    body,
  );
  return response.data;
}

function stripMeta(variables) {
  const { _meta, ...rest } = variables;
  return { clean: rest, meta: _meta || {} };
}

function buildAlumnoQuery({ q, materiaId }) {
  const params = [];
  const conditions = ["u.role = 'alumno'"];

  if (q) {
    conditions.push(
      "(LOWER(COALESCE(u.nombre_completo, u.username)) LIKE ? OR CAST(u.id AS TEXT) LIKE ?)",
    );
    params.push(`%${q.toLowerCase()}%`, `%${q}%`);
  }

  if (materiaId) {
    conditions.push(
      "EXISTS (SELECT 1 FROM inscripciones i WHERE i.alumno_id = u.id AND i.materia_id = ? AND i.estado = 'activa')",
    );
    params.push(materiaId);
  }

  return {
    sql: `
      SELECT
        u.id,
        COALESCE(u.nombre_completo, u.username) AS nombre_completo,
        u.email,
        u.id AS legajo
      FROM users u
      WHERE ${conditions.join(" AND ")}
      ORDER BY COALESCE(u.nombre_completo, u.username) ASC
      LIMIT 50
    `,
    params,
  };
}

router.get("/alumnos", (req, res) => {
  const q = String(req.query.q || "").trim();
  const materiaId = req.query.materia_id
    ? toPositiveInt(req.query.materia_id)
    : null;

  if (req.query.materia_id && !materiaId) {
    return res.status(400).json({ error: "materia_id inválido." });
  }

  const query = buildAlumnoQuery({ q, materiaId });
  const alumnos = db.prepare(query.sql).all(...query.params);
  return res.status(200).json(alumnos);
});

router.get("/variables/:legajo/abandono", (req, res) => {
  const legajo = toPositiveInt(req.params.legajo);
  if (!legajo) {
    return res.status(400).json({ error: "Legajo inválido." });
  }

  try {
    const variables = calcularVariablesAbandono(legajo);
    return res.status(200).json(variables);
  } catch (error) {
    return res.status(404).json({ error: error.message });
  }
});

router.get("/variables/:legajo/materia/:materiaId/:anio", (req, res) => {
  const legajo = toPositiveInt(req.params.legajo);
  const materiaId = toPositiveInt(req.params.materiaId);
  const anio = toPositiveInt(req.params.anio);

  if (!legajo || !materiaId || !anio) {
    return res.status(400).json({ error: "Parámetros inválidos." });
  }

  try {
    const variables = calcularVariablesRecursado(legajo, materiaId, anio);
    return res.status(200).json(variables);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

router.get(
  "/variables/:legajo/examen/:materiaId/:tipoExamen/:instancia/:anio",
  (req, res) => {
    const legajo = toPositiveInt(req.params.legajo);
    const materiaId = toPositiveInt(req.params.materiaId);
    const tipoExamen = normalizeTipoExamen(req.params.tipoExamen);
    const instancia = toPositiveInt(req.params.instancia);
    const anio = toPositiveInt(req.params.anio);

    if (!legajo || !materiaId || !tipoExamen || !instancia || !anio) {
      return res.status(400).json({ error: "Parámetros inválidos." });
    }

    try {
      const variables = calcularVariablesExamen(
        legajo,
        materiaId,
        tipoExamen,
        instancia,
        anio,
      );
      return res.status(200).json(variables);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  },
);

router.post("/predecir/:legajo/abandono", async (req, res) => {
  const legajo = toPositiveInt(req.params.legajo);
  if (!legajo) {
    return res.status(400).json({ error: "Legajo inválido." });
  }

  try {
    const variables = calcularVariablesAbandono(legajo);
    const { clean, meta } = stripMeta(variables);
    const data = await callAiPrediction("alumno", [clean]);
    const resultado = data?.[0] || null;

    insertPredictionLog.run(
      req.user.id,
      "alumno",
      JSON.stringify(clean),
      JSON.stringify(resultado),
    );

    const warning = meta.warningSinHistorial
      ? "Este alumno no tiene historial académico. Las predicciones pueden no ser confiables."
      : null;

    return res.status(200).json({
      variables,
      resultado,
      alumno: meta,
      warning,
    });
  } catch (error) {
    if (error.message?.includes("no encontrado")) {
      return res.status(404).json({ error: error.message });
    }

    return handleAiServiceError(error, res);
  }
});

router.post("/predecir/:legajo/materia/:materiaId/:anio", async (req, res) => {
  const legajo = toPositiveInt(req.params.legajo);
  const materiaId = toPositiveInt(req.params.materiaId);
  const anio = toPositiveInt(req.params.anio);

  if (!legajo || !materiaId || !anio) {
    return res.status(400).json({ error: "Parámetros inválidos." });
  }

  try {
    const variables = calcularVariablesRecursado(legajo, materiaId, anio);
    const { clean, meta } = stripMeta(variables);
    const data = await callAiPrediction("materia", [clean]);
    const resultado = data?.[0] || null;

    insertPredictionLog.run(
      req.user.id,
      "materia",
      JSON.stringify(clean),
      JSON.stringify(resultado),
    );

    return res.status(200).json({ variables, resultado, alumno: meta });
  } catch (error) {
    if (error.response || error.code) {
      return handleAiServiceError(error, res);
    }
    return res.status(400).json({ error: error.message });
  }
});

router.post(
  "/predecir/:legajo/examen/:materiaId/:tipoExamen/:instancia/:anio",
  async (req, res) => {
    const legajo = toPositiveInt(req.params.legajo);
    const materiaId = toPositiveInt(req.params.materiaId);
    const tipoExamen = normalizeTipoExamen(req.params.tipoExamen);
    const instancia = toPositiveInt(req.params.instancia);
    const anio = toPositiveInt(req.params.anio);

    if (!legajo || !materiaId || !tipoExamen || !instancia || !anio) {
      return res.status(400).json({ error: "Parámetros inválidos." });
    }

    try {
      const variables = calcularVariablesExamen(
        legajo,
        materiaId,
        tipoExamen,
        instancia,
        anio,
      );
      const { clean, meta } = stripMeta(variables);
      const data = await callAiPrediction("examen", [clean]);
      const resultado = data?.[0] || null;

      insertPredictionLog.run(
        req.user.id,
        "examen",
        JSON.stringify(clean),
        JSON.stringify(resultado),
      );

      return res.status(200).json({ variables, resultado, alumno: meta });
    } catch (error) {
      if (error.response || error.code) {
        return handleAiServiceError(error, res);
      }
      return res.status(400).json({ error: error.message });
    }
  },
);

async function procesarEnLotes(items, size, processor) {
  const resultados = [];
  const errores = [];

  for (let index = 0; index < items.length; index += size) {
    const lote = items.slice(index, index + size);

    const loteResultados = await Promise.all(
      lote.map(async (item) => {
        try {
          const value = await processor(item);
          return { ok: true, value };
        } catch (error) {
          return { ok: false, error, item };
        }
      }),
    );

    for (const entry of loteResultados) {
      if (entry.ok) {
        resultados.push(entry.value);
      } else {
        errores.push({
          legajo: entry.item?.id,
          error: entry.error?.message || "Error al procesar alumno",
        });
      }
    }
  }

  return { resultados, errores };
}

function obtenerAlumnosParaMasivo(materiaId) {
  if (materiaId) {
    return db
      .prepare(
        `
        SELECT DISTINCT
          u.id,
          COALESCE(u.nombre_completo, u.username) AS nombre
        FROM users u
        JOIN inscripciones i ON i.alumno_id = u.id
        WHERE u.role = 'alumno'
          AND i.materia_id = ?
          AND i.estado = 'activa'
        ORDER BY nombre ASC
      `,
      )
      .all(materiaId);
  }

  return db
    .prepare(
      `
      SELECT id, COALESCE(nombre_completo, username) AS nombre
      FROM users
      WHERE role = 'alumno'
      ORDER BY nombre ASC
    `,
    )
    .all();
}

router.post("/predecir-masivo/abandono", async (req, res) => {
  const materiaId = req.body?.materia_id
    ? toPositiveInt(req.body.materia_id)
    : null;

  if (req.body?.materia_id && !materiaId) {
    return res.status(400).json({ error: "materia_id inválido." });
  }

  const alumnos = obtenerAlumnosParaMasivo(materiaId);

  if (!alumnos.length) {
    return res.status(200).json({
      total: 0,
      procesados: 0,
      errores: 0,
      resultados: [],
      message: "No hay alumnos registrados para hacer predicción masiva.",
    });
  }

  try {
    const { resultados, errores } = await procesarEnLotes(
      alumnos,
      10,
      async (alumno) => {
        const variables = calcularVariablesAbandono(alumno.id);
        const { clean } = stripMeta(variables);
        const response = await callAiPrediction("alumno", [clean]);
        const resultado = response?.[0] || {};

        insertPredictionLog.run(
          req.user.id,
          "alumno",
          JSON.stringify(clean),
          JSON.stringify(resultado),
        );

        return {
          legajo: alumno.id,
          nombre: alumno.nombre,
          Abandona: Boolean(resultado.Abandona),
          probabilidad: Number(resultado.probabilidad || 0),
        };
      },
    );

    return res.status(200).json({
      total: alumnos.length,
      procesados: resultados.length,
      errores: errores.length,
      resultados,
      detalles_errores: errores,
    });
  } catch (error) {
    return handleAiServiceError(error, res);
  }
});

router.post("/predecir-masivo/materia/:materiaId/:anio", async (req, res) => {
  const materiaId = toPositiveInt(req.params.materiaId);
  const anio = toPositiveInt(req.params.anio);

  if (!materiaId || !anio) {
    return res.status(400).json({ error: "Parámetros inválidos." });
  }

  const alumnos = db
    .prepare(
      `
      SELECT DISTINCT
        u.id,
        COALESCE(u.nombre_completo, u.username) AS nombre
      FROM users u
      JOIN inscripciones i ON i.alumno_id = u.id
      WHERE u.role = 'alumno'
        AND i.materia_id = ?
        AND i.anio = ?
        AND i.estado = 'activa'
      ORDER BY nombre ASC
    `,
    )
    .all(materiaId, anio);

  if (!alumnos.length) {
    return res.status(200).json({
      total: 0,
      procesados: 0,
      errores: 0,
      resultados: [],
      message: "No hay alumnos registrados para hacer predicción masiva.",
    });
  }

  try {
    const { resultados, errores } = await procesarEnLotes(
      alumnos,
      10,
      async (alumno) => {
        const variables = calcularVariablesRecursado(
          alumno.id,
          materiaId,
          anio,
        );
        const { clean } = stripMeta(variables);
        const response = await callAiPrediction("materia", [clean]);
        const resultado = response?.[0] || {};

        insertPredictionLog.run(
          req.user.id,
          "materia",
          JSON.stringify(clean),
          JSON.stringify(resultado),
        );

        return {
          legajo: alumno.id,
          nombre: alumno.nombre,
          Recursa: Boolean(resultado.Recursa),
          probabilidad: Number(resultado.probabilidad || 0),
        };
      },
    );

    return res.status(200).json({
      total: alumnos.length,
      procesados: resultados.length,
      errores: errores.length,
      resultados,
      detalles_errores: errores,
    });
  } catch (error) {
    return handleAiServiceError(error, res);
  }
});

router.post(
  "/predecir-masivo/examen/:materiaId/:tipoExamen/:instancia/:anio",
  async (req, res) => {
    const materiaId = toPositiveInt(req.params.materiaId);
    const tipoExamen = normalizeTipoExamen(req.params.tipoExamen);
    const instancia = toPositiveInt(req.params.instancia);
    const anio = toPositiveInt(req.params.anio);

    if (!materiaId || !tipoExamen || !instancia || !anio) {
      return res.status(400).json({ error: "Parámetros inválidos." });
    }

    const alumnos = db
      .prepare(
        `
        SELECT DISTINCT
          u.id,
          COALESCE(u.nombre_completo, u.username) AS nombre
        FROM users u
        JOIN inscripciones i ON i.alumno_id = u.id
        WHERE u.role = 'alumno'
          AND i.materia_id = ?
          AND i.anio = ?
          AND i.estado = 'activa'
        ORDER BY nombre ASC
      `,
      )
      .all(materiaId, anio);

    if (!alumnos.length) {
      return res.status(200).json({
        total: 0,
        procesados: 0,
        errores: 0,
        resultados: [],
        message: "No hay alumnos registrados para hacer predicción masiva.",
      });
    }

    try {
      const { resultados, errores } = await procesarEnLotes(
        alumnos,
        10,
        async (alumno) => {
          const variables = calcularVariablesExamen(
            alumno.id,
            materiaId,
            tipoExamen,
            instancia,
            anio,
          );
          const { clean } = stripMeta(variables);
          const response = await callAiPrediction("examen", [clean]);
          const resultado = response?.[0] || {};

          insertPredictionLog.run(
            req.user.id,
            "examen",
            JSON.stringify(clean),
            JSON.stringify(resultado),
          );

          return {
            legajo: alumno.id,
            nombre: alumno.nombre,
            Nota: Number(resultado.Nota || 0),
          };
        },
      );

      return res.status(200).json({
        total: alumnos.length,
        procesados: resultados.length,
        errores: errores.length,
        resultados,
        detalles_errores: errores,
      });
    } catch (error) {
      return handleAiServiceError(error, res);
    }
  },
);

module.exports = router;
