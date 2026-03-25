const axios = require("axios");
const db = require("../db/database");
const {
  calcularVariablesAbandono,
  calcularVariablesRecursado,
  calcularVariablesExamen,
} = require("./prediction-variables.service");

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

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

// Recursado variables don't need special normalization
function normalizeMateriaPayload(payload) {
  return payload;
}

// Examen variables don't need special normalization, but ensure types are correct
function normalizeExamenPayload(payload) {
  return payload.map((item) => ({
    ...item,
    // Ensure numeric types
    Materia: Number(item.Materia),
    Instancia: Number(item.Instancia),
    Asistencia: Number(item.Asistencia),
    VecesRecursada: Number(item.VecesRecursada),
    Genero: Number(item.Genero),
    Edad: Number(item.Edad),
    AyudaFinanciera: Number(item.AyudaFinanciera),
    ColegioTecnico: Number(item.ColegioTecnico),
    PromedioColegio: Number(item.PromedioColegio),
    AniosDesdeIngreso: Number(item.AniosDesdeIngreso),
    VecesCursadaMateria: Number(item.VecesCursadaMateria),
    TasaRecursaMateria: Number(item.TasaRecursaMateria),
    PromedioAsistenciaHistMateria: Number(item.PromedioAsistenciaHistMateria),
    TotalCursadasGeneral: Number(item.TotalCursadasGeneral),
    TasaRecursaGeneral: Number(item.TasaRecursaGeneral),
    PromedioAsistenciaGeneral: Number(item.PromedioAsistenciaGeneral),
    PosicionFlujo: Number(item.PosicionFlujo),
    AsistenciaBajaRiesgo: Number(item.AsistenciaBajaRiesgo),
    NotaPromedioParcialCursada: Number(item.NotaPromedioParcialCursada),
    CantParcialesAprobados: Number(item.CantParcialesAprobados),
    EsUltimaInstancia: Number(item.EsUltimaInstancia),
    TieneFinalAM1: Number(item.TieneFinalAM1),
    Anio: Number(item.Anio),
  }));
}

function getRiskLevel(probabilidad) {
  const prob = Number(probabilidad || 0);

  if (prob >= 0.7) {
    return {
      level: "ALTO",
      color: "red",
      label: "Riesgo alto de abandono",
      icon: "🔴",
    };
  }

  if (prob >= 0.5) {
    return {
      level: "MEDIO",
      color: "yellow",
      label: "Riesgo medio de abandono",
      icon: "🟡",
    };
  }

  return {
    level: "BAJO",
    color: "green",
    label: "Bajo riesgo de abandono",
    icon: "🟢",
  };
}

function getRecursadoRiskLevel(probabilidad) {
  const prob = Number(probabilidad || 0);

  if (prob >= 0.7) {
    return {
      level: "ALTO",
      color: "red",
      label: "Riesgo alto de recursado",
      icon: "🔴",
    };
  }

  if (prob >= 0.5) {
    return {
      level: "MEDIO",
      color: "yellow",
      label: "Riesgo medio de recursado",
      icon: "🟡",
    };
  }

  return {
    level: "BAJO",
    color: "green",
    label: "Bajo riesgo de recursado",
    icon: "🟢",
  };
}

function getNotaLevel(nota) {
  const n = Number(nota || 0);

  if (n < 4) {
    return {
      level: "REPROBADO",
      color: "red",
      label: "Reprobado",
      icon: "❌",
      rating: "Bajo",
    };
  }

  if (n < 6) {
    return {
      level: "APROBADO",
      color: "orange",
      label: "Aprobado",
      icon: "✅",
      rating: "Regular",
    };
  }

  if (n < 8) {
    return {
      level: "BUENO",
      color: "amber",
      label: "Bueno",
      icon: "⭐",
      rating: "Bueno",
    };
  }

  return {
    level: "EXCELENTE",
    color: "green",
    label: "Excelente",
    icon: "⭐⭐",
    rating: "Excelente",
  };
}

function obtenerProximosExamenes(alumnoId, materiaId) {
  const cursada = db
    .prepare(
      `
    SELECT c.anio, c.estado
    FROM cursadas c
    WHERE c.alumno_id = ? AND c.materia_id = ?
    ORDER BY c.anio DESC
    LIMIT 1
  `,
    )
    .get(alumnoId, materiaId);

  if (!cursada) {
    return [];
  }

  const anio = cursada.anio;

  // Definir secuencia de exámenes estándar para cualquier materia
  const tiposExamenes = [
    { tipo: "Parcial", instancia: 1 },
    { tipo: "Recuperatorio", instancia: 1 },
    { tipo: "Parcial", instancia: 2 },
    { tipo: "Recuperatorio", instancia: 2 },
    { tipo: "Final", instancia: 1 },
  ];

  // Buscar el primer examen no rendido
  for (const exam of tiposExamenes) {
    const yaRendido = db
      .prepare(
        `
        SELECT 1
        FROM examenes
        WHERE alumno_id = ? AND materia_id = ? AND anio = ?
          AND tipo = ? AND instancia = ?
        LIMIT 1
      `,
      )
      .get(alumnoId, materiaId, anio, exam.tipo, exam.instancia);

    if (!yaRendido) {
      return [{ ...exam, anio }];
    }
  }

  return [];
}

async function precalcularAbandonoParaAlumnos(alumnosIds) {
  if (!alumnosIds || alumnosIds.length === 0) {
    return {};
  }

  const results = {};

  try {
    // Calcular variables de abandono en paralelo
    const variablesPromises = alumnosIds.map(async (alumnoId) => {
      try {
        const variables = calcularVariablesAbandono(alumnoId);
        return { alumnoId, variables, error: null };
      } catch (error) {
        return { alumnoId, variables: null, error };
      }
    });

    const variablesResults = await Promise.all(variablesPromises);

    // Agrupar por batch y enviar a FastAPI
    const validVariables = variablesResults
      .filter((r) => r.variables && !r.error)
      .map((r) => ({
        alumnoId: r.alumnoId,
        variables: r.variables,
      }));

    if (validVariables.length === 0) {
      return results;
    }

    // Dividir en lotes de 10 para no sobrecargar FastAPI
    const BATCH_SIZE = 10;
    const batches = [];

    for (let i = 0; i < validVariables.length; i += BATCH_SIZE) {
      batches.push(validVariables.slice(i, i + BATCH_SIZE));
    }

    // Procesar cada lote
    for (const batch of batches) {
      try {
        const payload = batch.map((item) => item.variables);
        const normalizedPayload = normalizeAlumnoPayload(payload);

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/alumno`,
          normalizedPayload,
        );

        const predictions = response.data;

        // Mapear resultados
        batch.forEach((item, index) => {
          const pred = predictions[index];
          results[item.alumnoId] = {
            abandona: pred?.Abandona || false,
            probabilidad: pred?.probabilidad || 0,
            risk: getRiskLevel(pred?.probabilidad || 0),
          };
        });
      } catch (error) {
        console.error("Error calling FastAPI for batch:", error.message);
        // Si falla FastAPI, marcar como error pero continuar
        batch.forEach((item) => {
          results[item.alumnoId] = {
            abandona: null,
            probabilidad: null,
            risk: null,
            error: "No se pudo calcular predicción",
          };
        });
      }
    }
  } catch (error) {
    console.error("Error en precalcularAbandonoParaAlumnos:", error);
  }

  return results;
}

async function precalcularPrediccionesCompletas(alumnosIds, materiaId) {
  if (!alumnosIds || alumnosIds.length === 0) {
    return {};
  }

  const results = {};

  try {
    // Para cada alumno, calcular 3 predicciones: abandono, recursado, nota examen
    const promesasPredicciones = alumnosIds.map(async (alumnoId) => {
      try {
        const predicciones = {
          alumnoId,
          abandono: null,
          recursado: null,
          nota: null,
        };

        // 1. PREDICCIÓN DE ABANDONO
        try {
          const varsAbandono = calcularVariablesAbandono(alumnoId);
          predicciones.variables_abandono = varsAbandono;
        } catch (e) {
          console.error(
            `Error calculando abandono para ${alumnoId}:`,
            e.message,
          );
        }

        // 2. PREDICCIÓN DE RECURSADO (para la materia actual)
        try {
          const cursada = db
            .prepare(
              `
            SELECT c.anio
            FROM cursadas c
            WHERE c.alumno_id = ? AND c.materia_id = ?
            ORDER BY c.anio DESC
            LIMIT 1
          `,
            )
            .get(alumnoId, materiaId);

          console.log(
            `[DEBUG] Alumno ${alumnoId}, Materia ${materiaId}: cursada found?`,
            cursada ? "YES" : "NO",
          );

          if (cursada) {
            try {
              const varsRecursado = calcularVariablesRecursado(
                alumnoId,
                materiaId,
                cursada.anio,
              );
              predicciones.variables_recursado = varsRecursado;
              predicciones.anio_recursado = cursada.anio;
              console.log(
                `[DEBUG] Recursado variables calculated for ${alumnoId}`,
              );
            } catch (calcError) {
              console.error(
                `[ERROR] calcularVariablesRecursado failed for ${alumnoId}:`,
                calcError.message,
              );
            }
          }
        } catch (e) {
          console.error(
            `Error calculando recursado para ${alumnoId}:`,
            e.message,
          );
        }

        // 3. PREDICCIÓN DE NOTA DE EXAMEN (próximo examen)
        try {
          const proximosExamenes = obtenerProximosExamenes(alumnoId, materiaId);
          console.log(
            `[DEBUG] Alumno ${alumnoId}, Materia ${materiaId}: proximosExamenes count = ${proximosExamenes.length}`,
          );

          if (proximosExamenes.length > 0) {
            const exam = proximosExamenes[0];
            try {
              const varsExamen = calcularVariablesExamen(
                alumnoId,
                materiaId,
                exam.tipo,
                exam.instancia,
                exam.anio,
              );
              predicciones.variables_examen = varsExamen;
              predicciones.examen_info = exam;
              console.log(
                `[DEBUG] Examen variables calculated for ${alumnoId}: ${exam.tipo} inst${exam.instancia}`,
              );
            } catch (calcError) {
              console.error(
                `[ERROR] calcularVariablesExamen failed for ${alumnoId}:`,
                calcError.message,
              );
            }
          }
        } catch (e) {
          console.error(`Error calculando nota para ${alumnoId}:`, e.message);
        }

        return predicciones;
      } catch (error) {
        console.error(`Error general para alumno ${alumnoId}:`, error);
        return {
          alumnoId,
          error: error.message,
        };
      }
    });

    const prediccionesCalculadas = await Promise.all(promesasPredicciones);

    // Agrupar por tipo de predicción para enviar a FastAPI en lotes
    const abandonoBatch = prediccionesCalculadas
      .filter((p) => p.variables_abandono)
      .map((p) => ({
        alumnoId: p.alumnoId,
        variables: p.variables_abandono,
      }));

    const recursadoBatch = prediccionesCalculadas
      .filter((p) => p.variables_recursado)
      .map((p) => ({
        alumnoId: p.alumnoId,
        variables: p.variables_recursado,
      }));

    const examenBatch = prediccionesCalculadas
      .filter((p) => p.variables_examen)
      .map((p) => ({
        alumnoId: p.alumnoId,
        variables: p.variables_examen,
      }));

    console.log(
      `[DEBUG] Batch sizes: abandono=${abandonoBatch.length}, recursado=${recursadoBatch.length}, examen=${examenBatch.length}`,
    );
    console.log(
      `[DEBUG] prediccionesCalculadas sample:`,
      prediccionesCalculadas.slice(0, 2),
    );

    const BATCH_SIZE = 10;

    // Procesar ABANDONO
    for (let i = 0; i < abandonoBatch.length; i += BATCH_SIZE) {
      const batch = abandonoBatch.slice(i, i + BATCH_SIZE);
      try {
        const payload = batch.map((item) => item.variables);
        const normalizedPayload = normalizeAlumnoPayload(payload);

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/alumno`,
          normalizedPayload,
        );

        batch.forEach((item, index) => {
          const pred = response.data[index];
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].abandono = {
            abandona: pred?.Abandona || false,
            probabilidad: pred?.probabilidad || 0,
            risk: getRiskLevel(pred?.probabilidad || 0),
          };
        });
      } catch (error) {
        console.error("Error predicción abandono:", error.message);
        batch.forEach((item) => {
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].abandono = {
            error: "No se pudo calcular",
          };
        });
      }
    }

    // Procesar RECURSADO
    for (let i = 0; i < recursadoBatch.length; i += BATCH_SIZE) {
      const batch = recursadoBatch.slice(i, i + BATCH_SIZE);
      try {
        const payload = batch.map((item) => item.variables);
        const normalizedPayload = normalizeMateriaPayload(payload);

        console.log(
          `[DEBUG] Calling FastAPI /predict/materia with ${payload.length} records...`,
        );
        console.log(`[DEBUG] URL: ${AI_SERVICE_URL}/predict/materia`);

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/materia`,
          normalizedPayload,
        );

        console.log(`[DEBUG] FastAPI /predict/materia responded with status ${response.status}`);

        batch.forEach((item, index) => {
          const pred = response.data[index];
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].recursado = {
            recursa: pred?.Recursa || false,
            probabilidad: pred?.probabilidad || 0,
            risk: getRecursadoRiskLevel(pred?.probabilidad || 0),
          };
        });
      } catch (error) {
        console.error(
          `[ERROR] /predict/materia failed: ${error.code || error.status} - ${error.message}`,
        );
        if (error.response) {
          console.error(`[ERROR] Response status: ${error.response.status}`);
          console.error(`[ERROR] Response data:`, error.response.data);
        }
        batch.forEach((item) => {
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].recursado = {
            error: "No se pudo calcular",
          };
        });
      }
    }

    // Procesar NOTA EXAMEN
    for (let i = 0; i < examenBatch.length; i += BATCH_SIZE) {
      const batch = examenBatch.slice(i, i + BATCH_SIZE);
      try {
        const payload = batch.map((item) => item.variables);
        const normalizedPayload = normalizeExamenPayload(payload);

        console.log(
          `[DEBUG] Calling FastAPI /predict/examen with ${payload.length} records...`,
        );
        console.log(`[DEBUG] URL: ${AI_SERVICE_URL}/predict/examen`);

        const response = await axios.post(
          `${AI_SERVICE_URL}/predict/examen`,
          normalizedPayload,
        );

        console.log(`[DEBUG] FastAPI /predict/examen responded with status ${response.status}`);

        batch.forEach((item, index) => {
          const pred = response.data[index];
          const examen = prediccionesCalculadas.find(
            (p) => p.alumnoId === item.alumnoId,
          );
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].nota = {
            nota: pred?.Nota || 0,
            examen_info: examen?.examen_info,
            nota_level: getNotaLevel(pred?.Nota),
          };
        });
      } catch (error) {
        console.error(
          `[ERROR] /predict/examen failed: ${error.code || error.status} - ${error.message}`,
        );
        if (error.response) {
          console.error(`[ERROR] Response status: ${error.response.status}`);
          console.error(`[ERROR] Response data:`, error.response.data);
        }
        batch.forEach((item) => {
          if (!results[item.alumnoId]) {
            results[item.alumnoId] = {};
          }
          results[item.alumnoId].nota = {
            error: "No se pudo calcular",
          };
        });
      }
    }
  } catch (error) {
    console.error("Error en precalcularPrediccionesCompletas:", error);
  }

  return results;
}

module.exports = {
  precalcularAbandonoParaAlumnos,
  precalcularPrediccionesCompletas,
  getRiskLevel,
  getRecursadoRiskLevel,
  getNotaLevel,
};
