const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");
const { passport } = require("../config/passport");
const { authenticate } = require("../middleware/auth.middleware");

const router = express.Router();
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

function buildFrontendRedirect(pathname, params = {}) {
  const search = new URLSearchParams(params).toString();
  return `${frontendUrl}${pathname}${search ? `?${search}` : ""}`;
}

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ message: "username y password son requeridos" });
  }

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ message: "JWT_SECRET no está configurado" });
  }

  const user = db
    .prepare(
      "SELECT id, username, password, role, email, nombre_completo, avatar_url FROM users WHERE username = ?",
    )
    .get(username);

  if (!user) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  if (!user.password) {
    return res.status(401).json({
      message: "Esta cuenta usa inicio de sesión con Google institucional",
    });
  }

  const passwordIsValid = await bcrypt.compare(password, user.password);

  if (!passwordIsValid) {
    return res.status(401).json({ message: "Credenciales inválidas" });
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    email: user.email,
    nombre_completo: user.nombre_completo,
    avatar_url: user.avatar_url,
  };
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "8h" });

  return res.status(200).json({ token, user: payload });
});

router.get("/google", (req, res, next) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.redirect(
      buildFrontendRedirect("/login", { error: "oauth_not_configured" }),
    );
  }

  return passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
    prompt: "select_account",
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  if (req.query.error === "access_denied") {
    return res.redirect(
      buildFrontendRedirect("/login", { error: "oauth_cancelled" }),
    );
  }

  return passport.authenticate(
    "google",
    { session: false },
    (error, user, info) => {
      if (error) {
        return res.redirect(
          buildFrontendRedirect("/login", { error: "oauth_failed" }),
        );
      }

      if (!user) {
        const failureCode = info?.code || "oauth_failed";
        return res.redirect(
          buildFrontendRedirect("/login", { error: failureCode }),
        );
      }

      if (!process.env.JWT_SECRET) {
        return res.redirect(
          buildFrontendRedirect("/login", { error: "server_error" }),
        );
      }

      const payload = {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        nombre_completo: user.nombre_completo,
        avatar_url: user.avatar_url,
      };

      const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: "8h",
      });

      return res.redirect(
        buildFrontendRedirect("/auth/callback", {
          token,
        }),
      );
    },
  )(req, res, next);
});

router.get("/me", authenticate, (req, res) => {
  return res.status(200).json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    email: req.user.email,
    nombre_completo: req.user.nombre_completo,
    avatar_url: req.user.avatar_url,
  });
});

module.exports = router;
