const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadsPath = process.env.UPLOADS_PATH || "./uploads";
const resolvedUploadsPath = path.isAbsolute(uploadsPath)
  ? uploadsPath
  : path.resolve(process.cwd(), uploadsPath);

if (!fs.existsSync(resolvedUploadsPath)) {
  fs.mkdirSync(resolvedUploadsPath, { recursive: true });
}

const allowedExtensions = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".txt",
]);

function sanitizeFileName(fileName) {
  const normalized = fileName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9._-]/g, "_");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resolvedUploadsPath);
  },
  filename: (req, file, cb) => {
    const safeName = sanitizeFileName(file.originalname || "archivo");
    cb(null, `${Date.now()}_${safeName}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname || "").toLowerCase();

    if (!allowedExtensions.has(extension)) {
      return cb(new Error("Tipo de archivo no permitido"));
    }

    return cb(null, true);
  },
});

module.exports = { upload, resolvedUploadsPath };
