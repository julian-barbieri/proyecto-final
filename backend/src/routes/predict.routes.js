const express = require("express");
const axios = require("axios");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const {
  calcularVariablesAbandono,
  calcularVariablesRecursado,
  calcularVariablesExamen,
} = require("../services/prediction-variables.service");

const { obtenerProximosExamenes } = require("../services/panel-predicciones.service");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const insertPredictionLog = db.prepare(
  "INSERT INTO predictions_log (user_id, tipo, input_data, result_data) VALUES (?, ?, ?, ?)",
);

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function handleAiServiceError(error, res) {
  if (error.code === "ECONNREFUSED") {
    return res.status(503).json({
      error:
        "El servicio de IA no está disponible. Verificá que la FastAPI esté corriendo en el puerto 8000.",
    });
  }

  if (error.response) {
    if (error.response.status === 422) {
      return res.status(422).json({
        error: "Datos de entrada inválidos",
        details: error.response.data,
      });
    }

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

async function proxyPrediction(req, res, tipo, endpoint, transformBody) {
  const originalBody = req.body;

  if (!isNonEmptyArray(originalBody)) {
    return res
      .status(422)
      .json({ error: "El body debe ser un array no vacío" });
  }

  const bodyToSend = transformBody ? transformBody(originalBody) : originalBody;

  try {
    const response = await axios.post(
      `${AI_SERVICE_URL}${endpoint}`,
      bodyToSend,
    );

    insertPredictionLog.run(
      req.user.id,
      tipo,
      JSON.stringify(originalBody),
      JSON.stringify(response.data),
    );

    return res.status(200).json(response.data);
  } catch (error) {
    return handleAiServiceError(error, res);
  }
}

router.post(
  "/alumno",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    return proxyPrediction(req, res, "alumno", "/predict/alumno");
  },
);

router.post(
  "/materia",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    return proxyPrediction(req, res, "materia", "/predict/materia");
  },
);

router.post(
  "/examen",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    return proxyPrediction(req, res, "examen", "/predict/examen");
  },
);

router.get("/health", authenticate, async (req, res) => {
  try {
    const response = await axios.get(`${AI_SERVICE_URL}/health`);
    return res.status(200).json(response.data);
  } catch (error) {
    return handleAiServiceError(error, res);
  }
});

router.post(
  "/alumno-smart",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    const { alumnoId } = req.body;
    if (!alumnoId) {
      return res.status(422).json({ error: "alumnoId es requerido." });
    }

    try {
      const { variables, meta } = calcularVariablesAbandono(Number(alumnoId));
      const response = await axios.post(`${AI_SERVICE_URL}/predict/alumno`, [variables]);
      const pred = response.data[0];

      insertPredictionLog.run(
        req.user.id,
        "alumno",
        JSON.stringify({ alumnoId }),
        JSON.stringify(pred),
      );

      return res.status(200).json({
        Abandona: pred.Abandona,
        probabilidad: pred.probabilidad,
        variables,
        meta,
      });
    } catch (error) {
      if (error.message?.includes("no encontrado")) {
        return res.status(404).json({ error: error.message });
      }
      return handleAiServiceError(error, res);
    }
  },
);

router.post(
  "/materia-smart",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    const { alumnoId, materiaId, anio } = req.body;
    if (!alumnoId || !materiaId || !anio) {
      return res.status(422).json({ error: "alumnoId, materiaId y anio son requeridos." });
    }

    try {
      const { variables, meta } = calcularVariablesRecursado(
        Number(alumnoId),
        Number(materiaId),
        Number(anio),
      );
      const response = await axios.post(`${AI_SERVICE_URL}/predict/materia`, [variables]);
      const pred = response.data[0];

      insertPredictionLog.run(
        req.user.id,
        "materia",
        JSON.stringify({ alumnoId, materiaId, anio }),
        JSON.stringify(pred),
      );

      return res.status(200).json({
        Recursa: pred.Recursa,
        probabilidad: pred.probabilidad,
        variables,
        meta,
      });
    } catch (error) {
      if (
        error.message?.includes("no encontrado") ||
        error.message?.includes("no tiene cursada")
      ) {
        return res.status(404).json({ error: error.message });
      }
      return handleAiServiceError(error, res);
    }
  },
);

router.post(
  "/examen-smart",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  async (req, res) => {
    const { alumnoId, materiaId, tipoExamen, instancia, anio } = req.body;
    if (!alumnoId || !materiaId || !tipoExamen || !instancia || !anio) {
      return res.status(422).json({
        error: "alumnoId, materiaId, tipoExamen, instancia y anio son requeridos.",
      });
    }

    try {
      const { variables, meta } = calcularVariablesExamen(
        Number(alumnoId),
        Number(materiaId),
        tipoExamen,
        Number(instancia),
        Number(anio),
      );
      const response = await axios.post(`${AI_SERVICE_URL}/predict/examen`, [variables]);
      const pred = response.data[0];

      insertPredictionLog.run(
        req.user.id,
        "examen",
        JSON.stringify({ alumnoId, materiaId, tipoExamen, instancia, anio }),
        JSON.stringify(pred),
      );

      return res.status(200).json({
        Nota: pred.Nota,
        examen_info: { tipoExamen, instancia: Number(instancia), anio: Number(anio) },
        variables,
        meta,
      });
    } catch (error) {
      if (
        error.message?.includes("no encontrado") ||
        error.message?.includes("no tiene cursada")
      ) {
        return res.status(404).json({ error: error.message });
      }
      return handleAiServiceError(error, res);
    }
  },
);

router.get(
  "/examen-proximo/:alumnoId/:materiaId",
  authenticate,
  authorize("admin", "docente", "coordinador"),
  (req, res) => {
    const alumnoId = Number(req.params.alumnoId);
    const materiaId = Number(req.params.materiaId);

    if (!alumnoId || !materiaId) {
      return res.status(422).json({ error: "alumnoId y materiaId son requeridos." });
    }

    const proximos = obtenerProximosExamenes(alumnoId, materiaId);

    if (proximos.length === 0) {
      return res.status(200).json({ proximo: null });
    }

    const p = proximos[0];
    return res.status(200).json({
      proximo: { tipoExamen: p.tipo, instancia: p.instancia, anio: p.anio },
    });
  },
);

module.exports = router;
