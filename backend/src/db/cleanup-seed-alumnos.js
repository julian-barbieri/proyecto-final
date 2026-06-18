const db = require("./database");

const USERNAMES_A_ELIMINAR = [
  "seed_0550", "seed_0592", "seed_0459", "seed_0609", "seed_0066",
  "seed_0402", "seed_0263", "seed_0304", "seed_0352", "seed_0418",
  "seed_0458", "seed_0046", "seed_0086", "seed_0472", "seed_0305",
  "seed_0399", "seed_0589", "seed_0091", "seed_0331", "seed_0293",
  "seed_0152", "seed_0202", "seed_0175", "seed_0076", "seed_0329",
  "seed_0617", "seed_0017", "seed_0355", "seed_0244", "seed_0001",
  "seed_0085", "seed_0335", "seed_0243", "seed_0503", "seed_0436",
  "seed_0283", "seed_0568", "seed_0208", "seed_0109", "seed_0319",
  "seed_0423", "seed_0582", "seed_0075", "seed_0233", "seed_0564",
  "seed_0645", "seed_0199", "seed_0268", "seed_0113", "seed_0594",
  "seed_0570", "seed_0526", "seed_0410", "seed_0115", "seed_0089",
  "seed_0020", "seed_0512", "seed_0070", "seed_0629", "seed_0607",
  "seed_0132", "seed_0100", "seed_0050", "seed_0147", "seed_0317",
  "seed_0634", "seed_0174", "seed_0561", "seed_0036", "seed_0452",
  "seed_0122", "seed_0372", "seed_0403", "seed_0094", "seed_0513",
  "seed_0302", "seed_0488", "seed_0309",
];

function eliminarSeedAlumnos() {
  const placeholders = USERNAMES_A_ELIMINAR.map(() => "?").join(", ");
  const usuarios = db
    .prepare(`SELECT id FROM users WHERE username IN (${placeholders}) AND role = 'alumno'`)
    .all(...USERNAMES_A_ELIMINAR);

  if (usuarios.length === 0) {
    console.log("ℹ️  No se encontraron alumnos con esos usernames.");
    return;
  }

  const ids = usuarios.map((u) => u.id);
  const ph = ids.map(() => "?").join(", ");

  db.transaction(() => {
    const convIds = db
      .prepare(`SELECT id FROM conversaciones WHERE alumno_id IN (${ph}) OR tutor_id IN (${ph}) OR participante_a_id IN (${ph}) OR participante_b_id IN (${ph})`)
      .all(...ids, ...ids, ...ids, ...ids)
      .map((r) => r.id);
    if (convIds.length > 0) {
      const convPh = convIds.map(() => "?").join(", ");
      db.prepare(`DELETE FROM mensajes WHERE conversacion_id IN (${convPh})`).run(...convIds);
      db.prepare(`DELETE FROM conversaciones WHERE id IN (${convPh})`).run(...convIds);
    }
    db.prepare(`DELETE FROM visualizaciones WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM contenido WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM predictions_log WHERE user_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM examenes WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM cursadas WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM inscripciones WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...ids);
  })();

  console.log(`✅ ${ids.length} alumnos seed eliminados.`);
}

eliminarSeedAlumnos();
