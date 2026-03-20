const bcrypt = require("bcryptjs");
const db = require("./database");

async function seedUsers() {
  const users = [
    { username: "director", password: "director123", role: "admin" },
    { username: "docente", password: "docente123", role: "docente" },
    { username: "coordinador", password: "coord123", role: "coordinador" },
    { username: "alumno", password: "alumno123", role: "alumno" },
  ];

  const insertUser = db.prepare(
    "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
  );
  const findUserByUsername = db.prepare(
    "SELECT id FROM users WHERE username = ?",
  );
  const updateUserRole = db.prepare("UPDATE users SET role = ? WHERE id = ?");
  let createdUsers = 0;
  let updatedRoles = 0;

  for (const user of users) {
    const existingUser = findUserByUsername.get(user.username);

    if (existingUser) {
      updateUserRole.run(user.role, existingUser.id);
      updatedRoles += 1;
      continue;
    }

    const hashedPassword = await bcrypt.hash(user.password, 10);
    insertUser.run(user.username, hashedPassword, user.role);
    createdUsers += 1;
  }

  console.log(
    `Seed usuarios completado. Nuevos: ${createdUsers}. Roles actualizados: ${updatedRoles}.`,
  );
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error("Error al ejecutar seed:", error);
    process.exit(1);
  });
}

module.exports = { seedUsers };
