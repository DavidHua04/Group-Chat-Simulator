import multer from "multer";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { UPLOADS_DIR } from "./db.js";

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (_req, file, cb) =>
    cb(null, randomUUID() + path.extname(file.originalname).toLowerCase().slice(0, 10)),
});

export const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 5 },
});

/** multer decodes originalname as latin1; recover UTF-8 names. */
export function originalName(file: Express.Multer.File): string {
  try {
    return Buffer.from(file.originalname, "latin1").toString("utf8");
  } catch {
    return file.originalname;
  }
}
