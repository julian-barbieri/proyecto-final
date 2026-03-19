const path = require("path");
const Database = require("better-sqlite3");

const dbPath = process.env.DB_PATH || "./database.sqlite";
const resolvedDbPath = path.isAbsolute(dbPath)
  ? dbPath
  : path.resolve(process.cwd(), dbPath);

const db = new Database(resolvedDbPath);

db.pragma("foreign_keys = ON");

const USERS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL CHECK(role IN ('admin', 'docente', 'coordinador', 'alumno')),
    google_id TEXT UNIQUE,
    email TEXT UNIQUE,
    nombre_completo TEXT,
    avatar_url TEXT,
    oauth_provider TEXT CHECK(oauth_provider IN ('google', 'local')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

db.exec(USERS_TABLE_SQL);

function migrateUsersSchemaIfNeeded() {
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();

  if (!tableInfo.length) {
    return;
  }

  const columnNames = new Set(tableInfo.map((column) => column.name));
  const passwordColumn = tableInfo.find((column) => column.name === "password");
  const passwordIsNotNull = passwordColumn?.notnull === 1;

  const requiredOAuthColumns = [
    "google_id",
    "email",
    "nombre_completo",
    "avatar_url",
    "oauth_provider",
  ];

  const missingOAuthColumns = requiredOAuthColumns.filter(
    (columnName) => !columnNames.has(columnName),
  );

  if (!passwordIsNotNull && missingOAuthColumns.length === 0) {
    return;
  }

  const selectExpression = [
    "id",
    "username",
    columnNames.has("password") ? "password" : "NULL AS password",
    "role",
    columnNames.has("google_id") ? "google_id" : "NULL AS google_id",
    columnNames.has("email") ? "email" : "NULL AS email",
    columnNames.has("nombre_completo")
      ? "nombre_completo"
      : "NULL AS nombre_completo",
    columnNames.has("avatar_url") ? "avatar_url" : "NULL AS avatar_url",
    columnNames.has("oauth_provider")
      ? "oauth_provider"
      : "NULL AS oauth_provider",
    columnNames.has("created_at")
      ? "created_at"
      : "CURRENT_TIMESTAMP AS created_at",
  ].join(", ");

  try {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT,
        role TEXT NOT NULL CHECK(role IN ('admin', 'docente', 'coordinador', 'alumno')),
        google_id TEXT UNIQUE,
        email TEXT UNIQUE,
        nombre_completo TEXT,
        avatar_url TEXT,
        oauth_provider TEXT CHECK(oauth_provider IN ('google', 'local')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    db.exec(`
      INSERT INTO users_new (
        id,
        username,
        password,
        role,
        google_id,
        email,
        nombre_completo,
        avatar_url,
        oauth_provider,
        created_at
      )
      SELECT ${selectExpression}
      FROM users;
    `);

    db.exec("DROP TABLE users");
    db.exec("ALTER TABLE users_new RENAME TO users");
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

migrateUsersSchemaIfNeeded();

db.exec(`
  CREATE TABLE IF NOT EXISTS predictions_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    tipo TEXT NOT NULL CHECK(tipo IN ('alumno', 'materia', 'examen')),
    input_data TEXT NOT NULL,
    result_data TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

module.exports = db;
