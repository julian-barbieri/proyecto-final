const db = require("./database");

const NOMBRES_A_ELIMINAR = [
  "Javier Martínez",
  "Raúl Campos",
  "Martín Espinosa",
  "Lucas Ponce",
  "Emilio Prieto",
  "Raúl Arias",
  "Ezequiel Paz",
  "Santiago Rivero",
  "Santiago Fernández",
  "Rodrigo Díaz",
  "Federico Molina",
  "Julio Blanco",
  "Carlos Serrano",
  "Ezequiel Ponce",
  "Marcos Gómez",
  "Lionel Villalba",
  "Gustavo Figueroa",
  "Sebastián Torres",
  "Iván Miranda",
  "Gustavo Blanco",
  "Diego Benítez",
  "Hernán Mercado",
  "Andrés Ponce",
  "Raúl Meza",
  "César Molina",
  "Darío Lagos",
  "Fernando Torres",
  "Federico Mercado",
  "Claudio Galindo",
  "Ignacio Díaz",
  "Alejandro Juárez",
  "Lucas Quiñones",
  "Pablo Cruz",
  "Sergio Delgado",
  "Diego Pérez",
  "Cristian Prieto",
  "Damián Blanco",
  "Emilio Medina",
  "Fernando Salas",
  "Mauricio Cardozo",
  "Rubén Arias",
  "Víctor Lagos",
  "Víctor Vega",
  "César Castro",
  "Gustavo Ibáñez",
  "Santiago Reyes",
  "Hugo Lagos",
  "Raúl Ibarra",
  "Marcos Martínez",
  "Iván Herrera",
  "Mateo García",
  "Joaquín Benítez",
  "Adrián Cruz",
  "Ignacio Cáceres",
  "Mauricio Montenegro",
  "Federico Herrera",
  "Ezequiel Fuentes",
  "Lucas Vargas",
  "Paola Arias",
  "Santiago Luna",
  "Javier Acosta",
];

function eliminarAlumnosEstancados() {
  const placeholders = NOMBRES_A_ELIMINAR.map(() => "?").join(", ");
  const usuarios = db
    .prepare(`SELECT id FROM users WHERE nombre_completo IN (${placeholders}) AND role = 'alumno'`)
    .all(...NOMBRES_A_ELIMINAR);

  if (usuarios.length === 0) {
    console.log("ℹ️  No se encontraron alumnos con esos nombres.");
    return;
  }

  const ids = usuarios.map((u) => u.id);
  const ph = ids.map(() => "?").join(", ");

  db.transaction(() => {
    db.prepare(`DELETE FROM mensajes WHERE conversacion_id IN (SELECT id FROM conversaciones WHERE alumno_id IN (${ph}))`).run(...ids);
    db.prepare(`DELETE FROM conversaciones WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM visualizaciones WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM contenido WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM examenes WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM cursadas WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM inscripciones WHERE alumno_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM predictions_log WHERE user_id IN (${ph})`).run(...ids);
    db.prepare(`DELETE FROM users WHERE id IN (${ph})`).run(...ids);
  })();

  console.log(`✅ ${ids.length} alumnos estancados eliminados.`);
}

eliminarAlumnosEstancados();
