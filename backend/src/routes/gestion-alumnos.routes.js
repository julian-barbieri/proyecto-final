const express = require("express");
const router = express.Router();
const db = require("../db/database");
const { authenticate, authorize } = require("../middleware/auth.middleware");
const axios = require("axios");

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/gestion-alumnos/alumnos/:alumnoId
// Devuelve el perfil completo del alumno con datos personales, académicos,
// indicadores calculados y 3 predicciones ML automáticas
// ═══════════════════════════════════════════════════════════════════════════

router.get(
  "/alumnos/:alumnoId",
  authenticate,
  authorize("admin", "coordinador"),
  async (req, res) => {
    try {
      const { alumnoId } = req.params;
      const id = parseInt(alumnoId);

      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de alumno inválido." });
      }

      // ── 1. Datos personales del alumno ───────────────────────────────────
      const alumno = db
        .prepare("SELECT * FROM users WHERE id = ? AND role = ?")
        .get(id, "alumno");

      if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado." });
      }

      // Calcular edad desde fecha_nac
      let edad = null;
      if (alumno.fecha_nac) {
        const [d, m, y] = alumno.fecha_nac.split("-").map(Number);
        const hoy = new Date();
        edad =
          hoy.getFullYear() -
          y -
          (hoy.getMonth() + 1 < m ||
          (hoy.getMonth() + 1 === m && hoy.getDate() < d)
            ? 1
            : 0);
      }

      // ── 2. Cursadas con exámenes anidados ────────────────────────────────
      const cursadas = db
        .prepare(
          `
        SELECT c.*, m.codigo AS materia_codigo, m.nombre AS materia_nombre, m.tipo AS materia_tipo
        FROM cursadas c
        JOIN materias m ON c.materia_id = m.id
        WHERE c.alumno_id = ?
        ORDER BY m.codigo ASC, c.anio DESC
      `,
        )
        .all(id);

      for (const cursada of cursadas) {
        cursada.examenes = db
          .prepare(
            `
          SELECT tipo, instancia, rendido, nota, ausente,
                 veces_recursada, asistencia, fecha_examen
          FROM examenes
          WHERE alumno_id = ? AND materia_id = ? AND anio = ?
          ORDER BY
            CASE tipo
              WHEN 'Parcial'       THEN 1
              WHEN 'Recuperatorio' THEN 2
              WHEN 'Final'         THEN 3
            END, instancia ASC
        `,
          )
          .all(id, cursada.materia_id, cursada.anio);
      }

      // ── 3. Indicadores calculados ────────────────────────────────────────
      const todosExamenes = db
        .prepare("SELECT * FROM examenes WHERE alumno_id = ?")
        .all(id);

      const examenesRendidos = todosExamenes.filter((e) => e.rendido === 1);
      const notas = examenesRendidos
        .map((e) => e.nota)
        .filter((n) => n !== null);
      const aprobados = notas.filter((n) => n >= 4);
      const cantCursadas = cursadas.length;
      const cantRecursadas = cursadas.filter(
        (c) => c.estado === "recursada",
      ).length;

      const indicadores = {
        cant_materias_cursadas: cantCursadas,
        cant_recursadas: cantRecursadas,
        tasa_recursado:
          cantCursadas > 0
            ? parseFloat((cantRecursadas / cantCursadas).toFixed(3))
            : 0,
        promedio_asistencia:
          cantCursadas > 0
            ? parseFloat(
                (
                  cursadas.reduce((s, c) => s + (c.asistencia || 0), 0) /
                  cantCursadas
                ).toFixed(3),
              )
            : 0,
        cant_examenes_rendidos: examenesRendidos.length,
        promedio_nota_global:
          notas.length > 0
            ? parseFloat(
                (notas.reduce((s, n) => s + n, 0) / notas.length).toFixed(2),
              )
            : null,
        cant_aprobados: aprobados.length,
        tasa_aprobacion:
          examenesRendidos.length > 0
            ? parseFloat(
                (aprobados.length / examenesRendidos.length).toFixed(3),
              )
            : 0,
        cant_ausencias: todosExamenes.filter((e) => e.ausente === 1).length,
        cant_finales_rendidos: examenesRendidos.filter(
          (e) => e.tipo === "Final",
        ).length,
        tiene_final_am1_aprobado: (() => {
          const am1 = db
            .prepare("SELECT id FROM materias WHERE codigo=?")
            .get("AM1");
          return am1
            ? db
                .prepare(
                  `
              SELECT COUNT(*) AS cnt FROM examenes
              WHERE alumno_id=? AND materia_id=? AND tipo='Final' AND nota>=4 AND rendido=1
            `,
                )
                .get(id, am1.id)?.cnt > 0
            : false;
        })(),
      };

      // ── 4. Predicciones ML (las 3 automáticas) ───────────────────────────
      let predicciones = {
        abandono: null,
        recursado: null,
        proxima_nota: null,
        error: null,
      };

      try {
        const {
          calcularVariablesAbandono,
          calcularVariablesRecursado,
          calcularVariablesExamen,
        } = require("../services/prediction-variables.service");
        const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

        // ── Predicción 1: Abandono ──
        try {
          const varsAbandono = calcularVariablesAbandono(id);
          const bodyAbandono = { ...varsAbandono };
          delete bodyAbandono._meta;

          // Normalizar nombres de variables si es necesario
          if (!bodyAbandono.PromedioColegio_x) {
            bodyAbandono.PromedioColegio_x = bodyAbandono.PromedioColegio;
            bodyAbandono.PromedioColegio_y = bodyAbandono.PromedioColegio;
            delete bodyAbandono.PromedioColegio;
          }

          const respAbandono = await axios.post(
            `${AI_URL}/predict/alumno`,
            [bodyAbandono],
            { timeout: 8000 },
          );

          predicciones.abandono = {
            abandona: respAbandono.data[0].Abandona,
            probabilidad: respAbandono.data[0].probabilidad,
            nivel_riesgo:
              respAbandono.data[0].probabilidad >= 0.6
                ? "alto"
                : respAbandono.data[0].probabilidad >= 0.3
                  ? "medio"
                  : "bajo",
          };
        } catch (errAbandono) {
          console.error("Error predicción abandono:", errAbandono.message);
        }

        // ── Predicción 2: Recursado (cursada activa más reciente) ──
        try {
          const cursadaActiva = cursadas.find((c) => c.estado === "cursando");
          if (cursadaActiva) {
            const varsRecursado = calcularVariablesRecursado(
              id,
              cursadaActiva.materia_id,
              cursadaActiva.anio,
            );
            const bodyRecursado = { ...varsRecursado };
            delete bodyRecursado._meta;

            const respRecursado = await axios.post(
              `${AI_URL}/predict/materia`,
              [bodyRecursado],
              { timeout: 8000 },
            );

            predicciones.recursado = {
              recursa: respRecursado.data[0].Recursa,
              probabilidad: respRecursado.data[0].probabilidad,
              materia: cursadaActiva.materia_codigo,
              anio: cursadaActiva.anio,
            };
          }
        } catch (errRecursado) {
          console.error("Error predicción recursado:", errRecursado.message);
        }

        // ── Predicción 3: Próximas notas por materia en curso ──
        try {
          const cursadasActivas = cursadas.filter(
            (c) => c.estado === "cursando",
          );
          predicciones.proximas_notas = [];

          // Determina el próximo examen según el historial y el tipo de materia (A=anual, C=cuatrimestral).
          // Respeta la regla académica: aprobar Parcial N habilita Final (cuatrimestral) o Parcial N+1 (anual),
          // en lugar de pasar por Recuperatorio N innecesariamente.
          function getProximoExamen(examenes, materiaType) {
            const passed = (tipo, inst) =>
              examenes.some(
                (e) =>
                  e.tipo === tipo &&
                  e.instancia === inst &&
                  e.rendido === 1 &&
                  (e.nota ?? 0) >= 4,
              );
            const taken = (tipo, inst) =>
              examenes.some(
                (e) => e.tipo === tipo && e.instancia === inst && e.rendido === 1,
              );

            if (!taken("Parcial", 1)) return { tipo: "Parcial", inst: 1 };

            if (passed("Parcial", 1)) {
              if (materiaType === "A") {
                if (!taken("Parcial", 2)) return { tipo: "Parcial", inst: 2 };
                if (passed("Parcial", 2)) {
                  for (const inst of [1, 2, 3]) {
                    if (!taken("Final", inst)) return { tipo: "Final", inst };
                  }
                } else {
                  if (!taken("Recuperatorio", 2)) return { tipo: "Recuperatorio", inst: 2 };
                  if (passed("Recuperatorio", 2)) {
                    for (const inst of [1, 2, 3]) {
                      if (!taken("Final", inst)) return { tipo: "Final", inst };
                    }
                  }
                }
              } else {
                for (const inst of [1, 2, 3]) {
                  if (!taken("Final", inst)) return { tipo: "Final", inst };
                }
              }
            } else {
              if (!taken("Recuperatorio", 1)) return { tipo: "Recuperatorio", inst: 1 };
              if (passed("Recuperatorio", 1)) {
                if (materiaType === "A") {
                  if (!taken("Parcial", 2)) return { tipo: "Parcial", inst: 2 };
                  if (passed("Parcial", 2)) {
                    for (const inst of [1, 2, 3]) {
                      if (!taken("Final", inst)) return { tipo: "Final", inst };
                    }
                  } else {
                    if (!taken("Recuperatorio", 2)) return { tipo: "Recuperatorio", inst: 2 };
                    if (passed("Recuperatorio", 2)) {
                      for (const inst of [1, 2, 3]) {
                        if (!taken("Final", inst)) return { tipo: "Final", inst };
                      }
                    }
                  }
                } else {
                  for (const inst of [1, 2, 3]) {
                    if (!taken("Final", inst)) return { tipo: "Final", inst };
                  }
                }
              }
            }

            return null;
          }

          for (const cursadaActiva of cursadasActivas) {
            try {
              const exCursadaActiva = cursadaActiva.examenes || [];

              const proximoExamen = getProximoExamen(
                exCursadaActiva,
                cursadaActiva.materia_tipo ?? "C",
              );

              if (proximoExamen) {
                try {
                  const varsExamen = calcularVariablesExamen(
                    id,
                    cursadaActiva.materia_id,
                    proximoExamen.tipo,
                    proximoExamen.inst,
                    cursadaActiva.anio,
                  );
                  const bodyExamen = { ...varsExamen };
                  delete bodyExamen._meta;

                  const respExamen = await axios.post(
                    `${AI_URL}/predict/examen`,
                    [bodyExamen],
                    { timeout: 8000 },
                  );

                  predicciones.proximas_notas.push({
                    nota_predicha: respExamen.data[0].nota_predicha,
                    aprobaria: respExamen.data[0].nota_predicha >= 4,
                    tipo_examen: proximoExamen.tipo,
                    instancia: proximoExamen.inst,
                    materia: cursadaActiva.materia_codigo,
                    materia_nombre: cursadaActiva.materia_nombre,
                    anio: cursadaActiva.anio,
                  });
                } catch (errPredictExamen) {
                  // Sin datos suficientes para predecir nota de esta materia
                  console.error(
                    `Error predicción examen ${cursadaActiva.materia_codigo}:`,
                    errPredictExamen.message,
                  );
                }
              }
            } catch (errMateriaLoop) {
              console.error(
                `Error procesando cursada ${cursadaActiva.materia_codigo}:`,
                errMateriaLoop.message,
              );
            }
          }

          // Mantener compatibilidad: si solo hay una, también la asignamos a proxima_nota
          if (predicciones.proximas_notas.length === 1) {
            predicciones.proxima_nota = predicciones.proximas_notas[0];
          }
        } catch (errExamen) {
          console.error("Error predicción exámenes:", errExamen.message);
        }

        // Guardar en predictions_log
        const saveLog = (tipo, input, result) => {
          try {
            db.prepare(
              `
                INSERT INTO predictions_log (user_id, tipo, input_data, result_data, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
              `,
            ).run(id, tipo, JSON.stringify(input), JSON.stringify(result));
          } catch {
            // log no crítico
          }
        };

        if (predicciones.abandono) {
          saveLog("alumno", { tipo: "abandono" }, predicciones.abandono);
        }
        if (predicciones.recursado) {
          saveLog("materia", { tipo: "recursado" }, predicciones.recursado);
        }
        if (predicciones.proxima_nota) {
          saveLog("examen", { tipo: "nota" }, predicciones.proxima_nota);
        }
      } catch (errPrediccion) {
        console.error("Error general en predicciones:", errPrediccion.message);
        predicciones.error =
          "El servicio de predicciones no está disponible en este momento.";
      }

      // ── 5. Historial de predicciones guardadas ────────────────────────────
      const historialPredicciones = db
        .prepare(
          `
          SELECT tipo, result_data, created_at
          FROM predictions_log
          WHERE user_id = ?
          ORDER BY created_at DESC LIMIT 10
        `,
        )
        .all(id)
        .map((p) => ({
          tipo: p.tipo,
          resultado: (() => {
            try {
              return JSON.parse(p.result_data);
            } catch {
              return {};
            }
          })(),
          created_at: p.created_at,
        }));

      // ── Devolver respuesta ──
      res.json({
        alumno: {
          id: alumno.id,
          nombre_completo: alumno.nombre_completo,
          email: alumno.email,
          genero: alumno.genero,
          fecha_nac: alumno.fecha_nac,
          edad,
          ayuda_financiera: alumno.ayuda_financiera,
          colegio_tecnico: alumno.colegio_tecnico,
          promedio_colegio: alumno.promedio_colegio,
          anio_ingreso: alumno.anio_ingreso,
        },
        indicadores,
        cursadas,
        predicciones,
        historial_predicciones: historialPredicciones,
      });
    } catch (error) {
      console.error("Error en GET /alumnos/:alumnoId:", error);
      res.status(500).json({
        error: "Error al cargar el perfil del alumno",
        details: error.message,
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/gestion-alumnos/alumnos/:alumnoId
// Actualiza el campo ayuda_financiera del alumno
// ═══════════════════════════════════════════════════════════════════════════

router.patch(
  "/alumnos/:alumnoId",
  authenticate,
  authorize("admin", "coordinador"),
  (req, res) => {
    try {
      const { alumnoId } = req.params;
      const id = parseInt(alumnoId);
      const { ayuda_financiera } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de alumno inválido." });
      }

      // ── Validaciones ────────────────────────────────────────────────────
      if (ayuda_financiera === undefined) {
        return res.status(422).json({
          error: "Se requiere enviar el campo ayuda_financiera.",
        });
      }

      if (![0, 1].includes(parseInt(ayuda_financiera))) {
        return res
          .status(422)
          .json({ error: "Ayuda financiera debe ser 0 o 1." });
      }

      // ── Verificar que el alumno existe ──────────────────────────────────
      const alumno = db
        .prepare("SELECT id FROM users WHERE id = ? AND role = 'alumno'")
        .get(id);

      if (!alumno) {
        return res.status(404).json({ error: "Alumno no encontrado." });
      }

      // ── Ejecutar UPDATE ─────────────────────────────────────────────────
      db.prepare("UPDATE users SET ayuda_financiera = ? WHERE id = ?").run(
        parseInt(ayuda_financiera),
        id,
      );

      res.json({ message: "Datos actualizados correctamente." });
    } catch (error) {
      console.error("Error en PATCH /alumnos/:alumnoId:", error);
      res.status(500).json({
        error: "Error al actualizar los datos del alumno",
        details: error.message,
      });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/gestion-alumnos/alumnos/:alumnoId/simular
// Devuelve la predicción de abandono con un valor de ayuda_financiera
// diferente al actual, sin guardar en BD ni en predictions_log.
// ═══════════════════════════════════════════════════════════════════════════

router.post(
  "/alumnos/:alumnoId/simular",
  authenticate,
  authorize("admin", "coordinador"),
  async (req, res) => {
    try {
      const { alumnoId } = req.params;
      const id = parseInt(alumnoId);
      const { ayuda_financiera } = req.body;

      if (isNaN(id)) {
        return res.status(400).json({ error: "ID de alumno inválido." });
      }

      if (![0, 1].includes(parseInt(ayuda_financiera))) {
        return res
          .status(422)
          .json({ error: "ayuda_financiera debe ser 0 o 1." });
      }

      const {
        calcularVariablesAbandono,
      } = require("../services/prediction-variables.service");
      const AI_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

      const vars = calcularVariablesAbandono(id);
      const body = { ...vars };
      delete body._meta;

      body.AyudaFinanciera = parseInt(ayuda_financiera);

      if (!body.PromedioColegio_x) {
        body.PromedioColegio_x = body.PromedioColegio;
        body.PromedioColegio_y = body.PromedioColegio;
        delete body.PromedioColegio;
      }

      const resp = await axios.post(`${AI_URL}/predict/alumno`, [body], {
        timeout: 8000,
      });

      const resultado = resp.data[0];
      const prob = resultado.probabilidad;

      res.json({
        probabilidad: prob,
        abandona: resultado.Abandona,
        nivel_riesgo: prob >= 0.6 ? "alto" : prob >= 0.3 ? "medio" : "bajo",
      });
    } catch (error) {
      console.error("Error en simulación:", error.message);
      if (error.code === "ECONNREFUSED") {
        return res
          .status(503)
          .json({ error: "El servicio de IA no está disponible." });
      }
      res.status(500).json({ error: "Error al simular la predicción." });
    }
  },
);

module.exports = router;
