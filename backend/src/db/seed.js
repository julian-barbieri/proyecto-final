const bcrypt = require('bcryptjs');
const db = require('./database');

async function seedUsers() {
  const totalUsers = db.prepare('SELECT COUNT(*) AS count FROM users').get();

  if (totalUsers.count > 0) {
    return;
  }

  const users = [
    { username: 'admin', password: 'admin123', role: 'admin' },
    { username: 'docente1', password: 'docente123', role: 'docente' },
    { username: 'coordinador', password: 'coord123', role: 'coordinador' },
    { username: 'alumno1', password: 'alumno123', role: 'alumno' }
  ];

  const insertUser = db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)');

  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    insertUser.run(user.username, hashedPassword, user.role);
  }

  console.log('Usuarios de prueba creados correctamente.');
}

if (require.main === module) {
  seedUsers().catch((error) => {
    console.error('Error al ejecutar seed:', error);
    process.exit(1);
  });
}

module.exports = { seedUsers };