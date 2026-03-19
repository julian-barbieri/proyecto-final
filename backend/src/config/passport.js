const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const db = require("../db/database");

const INSTITUTIONAL_DOMAIN = "usal.edu.ar";

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  try {
    const user = db
      .prepare(
        "SELECT id, username, role, email, nombre_completo, avatar_url FROM users WHERE id = ?",
      )
      .get(id);

    done(null, user || false);
  } catch (error) {
    done(error);
  }
});

function configurePassport() {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const callbackURL =
    process.env.GOOGLE_CALLBACK_URL ||
    "http://localhost:3001/api/auth/google/callback";

  if (!clientID || !clientSecret) {
    console.warn(
      "[Auth] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no configurados. OAuth Google deshabilitado.",
    );
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID,
        clientSecret,
        callbackURL,
      },
      (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile?.emails?.[0]?.value?.toLowerCase();

          if (!email || !email.endsWith(`@${INSTITUTIONAL_DOMAIN}`)) {
            return done(null, false, {
              message: "Solo se permiten cuentas institucionales @usal.edu.ar",
              code: "invalid_domain",
            });
          }

          const googleId = profile.id;
          const fullName = profile.displayName || email;
          const avatar = profile.photos?.[0]?.value || null;

          const existingUserByGoogle = db
            .prepare(
              "SELECT id, username, role, email, nombre_completo, avatar_url FROM users WHERE google_id = ?",
            )
            .get(googleId);

          if (existingUserByGoogle) {
            db.prepare(
              "UPDATE users SET email = ?, nombre_completo = ?, avatar_url = ?, oauth_provider = ?, role = ? WHERE id = ?",
            ).run(
              email,
              fullName,
              avatar,
              "google",
              "admin",
              existingUserByGoogle.id,
            );

            const updatedUser = db
              .prepare(
                "SELECT id, username, role, email, nombre_completo, avatar_url FROM users WHERE id = ?",
              )
              .get(existingUserByGoogle.id);

            return done(null, updatedUser);
          }

          const existingUserByEmail = db
            .prepare("SELECT id, username, role FROM users WHERE email = ?")
            .get(email);

          if (existingUserByEmail) {
            db.prepare(
              "UPDATE users SET google_id = ?, nombre_completo = ?, avatar_url = ?, oauth_provider = ?, role = ? WHERE id = ?",
            ).run(
              googleId,
              fullName,
              avatar,
              "google",
              "admin",
              existingUserByEmail.id,
            );

            const updatedUser = db
              .prepare(
                "SELECT id, username, role, email, nombre_completo, avatar_url FROM users WHERE id = ?",
              )
              .get(existingUserByEmail.id);

            return done(null, updatedUser);
          }

          const baseUsername =
            email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "_") ||
            `user_${Date.now()}`;
          let username = baseUsername;
          let suffix = 1;

          while (
            db.prepare("SELECT id FROM users WHERE username = ?").get(username)
          ) {
            username = `${baseUsername}_${suffix}`;
            suffix += 1;
          }

          const insertResult = db
            .prepare(
              `
                INSERT INTO users (
                  username,
                  password,
                  role,
                  google_id,
                  email,
                  nombre_completo,
                  avatar_url,
                  oauth_provider
                ) VALUES (?, NULL, 'admin', ?, ?, ?, ?, 'google')
              `,
            )
            .run(username, googleId, email, fullName, avatar);

          const newUser = db
            .prepare(
              "SELECT id, username, role, email, nombre_completo, avatar_url FROM users WHERE id = ?",
            )
            .get(insertResult.lastInsertRowid);

          return done(null, newUser);
        } catch (error) {
          return done(error);
        }
      },
    ),
  );
}

module.exports = { passport, configurePassport };
