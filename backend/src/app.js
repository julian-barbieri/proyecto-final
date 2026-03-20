const express = require("express");
const path = require("path");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");

dotenv.config();

require("./db/database");
const { seedUsers } = require("./db/seed");
const { passport, configurePassport } = require("./config/passport");

const authRoutes = require("./routes/auth.routes");
const predictRoutes = require("./routes/predict.routes");
const historyRoutes = require("./routes/history.routes");
const studentsRoutes = require("./routes/students.routes");
const contenidoRoutes = require("./routes/contenido.routes");
const { authenticate } = require("./middleware/auth.middleware");

const app = express();
const PORT = process.env.PORT || 3001;
const sessionSecret = process.env.SESSION_SECRET || "dev_session_secret";
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
const uploadsPath = process.env.UPLOADS_PATH || "./uploads";
const resolvedUploadsPath = path.isAbsolute(uploadsPath)
  ? uploadsPath
  : path.resolve(process.cwd(), uploadsPath);

configurePassport();

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  }),
);
app.use(express.json());
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60,
    },
  }),
);
app.use(passport.initialize());
app.use(passport.session());
app.use("/uploads", express.static(resolvedUploadsPath));

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/predict", predictRoutes);
app.use("/api/history", historyRoutes);
app.use("/api/students", studentsRoutes);
app.use("/api/contenido", authenticate, contenidoRoutes);

seedUsers()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Error during startup:", error);
    process.exit(1);
  });
