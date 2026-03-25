const db = require("./src/db/database.js");
const {
  calcularVariablesAbandono,
  calcularVariablesRecursado,
  calcularVariablesExamen,
} = require("./src/services/prediction-variables.service.js");

// Helper function from panel-predicciones.service
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

  const tiposExamenes = [
    { tipo: "Parcial", instancia: 1 },
    { tipo: "Recuperatorio", instancia: 1 },
    { tipo: "Parcial", instancia: 2 },
    { tipo: "Recuperatorio", instancia: 2 },
    { tipo: "Final", instancia: 1 },
  ];

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

const alumnos = db
  .prepare("SELECT id FROM users WHERE role = 'alumno' ORDER BY id LIMIT 1")
  .all();
const alumnoId = alumnos[0].id;
const materiaId = 1;

console.log(
  `\n=== Testing with alumno ${alumnoId}, materia ${materiaId} ===\n`,
);

// Test 1: Abandono
console.log("1. Calculating Abandono variables...");
try {
  const vars = calcularVariablesAbandono(alumnoId);
  console.log("   ✓ Success");
  console.log(`   Keys: ${Object.keys(vars).slice(0, 5).join(", ")}...`);
} catch (e) {
  console.log(`   ✗ Error: ${e.message}`);
}

// Test 2: Recursado
console.log("\n2. Calculating Recursado variables...");
try {
  const cursada = db
    .prepare(
      `SELECT anio FROM cursadas WHERE alumno_id = ? AND materia_id = ? ORDER BY anio DESC LIMIT 1`,
    )
    .get(alumnoId, materiaId);

  if (!cursada) {
    console.log("   ✗ No cursada found");
  } else {
    console.log(`   Found cursada: year=${cursada.anio}`);
    const vars = calcularVariablesRecursado(alumnoId, materiaId, cursada.anio);
    console.log("   ✓ Success");
    console.log(`   Keys: ${Object.keys(vars).slice(0, 5).join(", ")}...`);
  }
} catch (e) {
  console.log(`   ✗ Error: ${e.message}`);
}

// Test 3: Examen
console.log("\n3. Calculating Examen variables...");
try {
  const proxExamenes = obtenerProximosExamenes(alumnoId, materiaId);
  console.log(`   Found próximos exámenes: ${proxExamenes.length}`);

  if (proxExamenes.length > 0) {
    const exam = proxExamenes[0];
    console.log(
      `   Próximo examen: ${exam.tipo} inst${exam.instancia} año ${exam.anio}`,
    );
    const vars = calcularVariablesExamen(
      alumnoId,
      materiaId,
      exam.tipo,
      exam.instancia,
      exam.anio,
    );
    console.log("   ✓ Success");
    console.log(`   Keys: ${Object.keys(vars).slice(0, 5).join(", ")}...`);
  } else {
    console.log("   ! No upcoming exams found");
  }
} catch (e) {
  console.log(`   ✗ Error: ${e.message}`);
}

console.log("\n=== All variable calculations completed ===\n");
