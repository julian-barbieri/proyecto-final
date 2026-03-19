const express = require("express");
const axios = require("axios");
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth.middleware");

const router = express.Router();
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

const insertPredictionLog = db.prepare(
  "INSERT INTO predictions_log (user_id, tipo, input_data, result_data) VALUES (?, ?, ?, ?)",
);

function isNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
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
    return proxyPrediction(
      req,
      res,
      "alumno",
      "/predict/alumno",
      normalizeAlumnoPayload,
    );
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

module.exports = router;
