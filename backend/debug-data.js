const db = require("./src/db/database.js");

const alumnos = db
  .prepare(
    "SELECT id, nombre_completo FROM users WHERE role = 'alumno' ORDER BY id LIMIT 3",
  )
  .all();
console.log("=== ALUMNOS ===");
console.log(`Total alumnos found: ${alumnos.length}`);
alumnos.forEach((a) => {
  console.log(`${a.id}: ${a.nombre_completo}`);
  const cursadas = db
    .prepare("SELECT * FROM cursadas WHERE alumno_id = ? AND materia_id = ?")
    .all(a.id, 1);
  console.log(`  Cursadas AM1 (materia_id=1): ${cursadas.length}`);
  cursadas.forEach((c) =>
    console.log(
      `    - Año ${c.anio}: estado=${c.estado}, asistencia=${c.asistencia}`,
    ),
  );

  const examenes = db
    .prepare("SELECT * FROM examenes WHERE alumno_id = ? AND materia_id = ?")
    .all(a.id, 1);
  console.log(`  Exámenes AM1 total: ${examenes.length}`);
  examenes.forEach((e) =>
    console.log(
      `    - ${e.tipo} inst${e.instancia} año ${e.anio}: rendido=${e.rendido}, nota=${e.nota}`,
    ),
  );
});
