/**
 * fix_notas_inconsistentes.js
 *
 * Detecta alumnos que aprobaron un parcial (nota >= 4) pero también
 * tienen registrado un recuperatorio de esa misma instancia.
 * En esos casos, baja la nota del parcial entre 1 y 3 puntos para
 * que el recuperatorio tenga sentido.
 *
 * Uso: node fix_notas_inconsistentes.js
 */

require("dotenv").config();
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./database.sqlite";
const resolvedDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.resolve(process.cwd(), dbPath);

const db = new Database(resolvedDbPath);

function randomDecremento() {
  return Math.floor(Math.random() * 3) + 1; // 1, 2 o 3
}

function procesarInstancia(instancia) {
  // Buscar parciales aprobados (nota >= 4) que tienen recuperatorio registrado
  const casos = db
    .prepare(
      `
    SELECT
      p.id          AS parcial_id,
      p.alumno_id,
      p.materia_id,
      p.anio,
      p.nota        AS nota_actual,
      r.id          AS recuperatorio_id
    FROM examenes p
    JOIN examenes r
      ON  r.alumno_id  = p.alumno_id
      AND r.materia_id = p.materia_id
      AND r.anio       = p.anio
      AND r.instancia  = p.instancia
      AND r.tipo       = 'Recuperatorio'
      AND r.rendido    = 1
    WHERE p.tipo     = 'Parcial'
      AND p.instancia = ?
      AND p.rendido  = 1
      AND p.nota     >= 4
  `
    )
    .all(instancia);

  if (casos.length === 0) {
    console.log(`  Parcial ${instancia}: no se encontraron casos inconsistentes.`);
    return;
  }

  console.log(
    `  Parcial ${instancia}: ${casos.length} caso/s inconsistente/s encontrado/s.`
  );

  const update = db.prepare(
    `UPDATE examenes SET nota = ? WHERE id = ?`
  );

  const runAll = db.transaction(() => {
    for (const caso of casos) {
      const decremento = randomDecremento();
      const nuevaNota = Math.max(0, caso.nota_actual - decremento);

      update.run(nuevaNota, caso.parcial_id);

      console.log(
        `    alumno_id=${caso.alumno_id} materia_id=${caso.materia_id} anio=${caso.anio}` +
          ` | nota ${caso.nota_actual} → ${nuevaNota} (−${decremento})`
      );
    }
  });

  runAll();
}

console.log("=== Corrección de notas de parciales inconsistentes ===\n");

procesarInstancia(1);
procesarInstancia(2);

console.log("\n✅ Proceso finalizado.");
db.close();
