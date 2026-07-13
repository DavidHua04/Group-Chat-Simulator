import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { UPLOADS_DIR } from "./db.js";
import { charactersRouter } from "./routes/characters.js";
import { groupsRouter } from "./routes/groups.js";
import { messagesRouter } from "./routes/messages.js";
import { settingsRouter } from "./routes/settings.js";
import { pruneForgotten } from "./engine/memory.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3001);

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use("/uploads", express.static(UPLOADS_DIR));
app.use("/api/characters", charactersRouter);
app.use("/api/groups", messagesRouter); // /:groupId/messages
app.use("/api/groups", groupsRouter);
app.use("/api/settings", settingsRouter);

// serve the built client in production (`npm run build` at repo root)
const clientDist = path.join(here, "..", "..", "client", "dist");
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api") && !req.path.startsWith("/uploads")) {
      return res.sendFile(path.join(clientDist, "index.html"));
    }
    next();
  });
}

// json error handler (multer errors, bad json, etc.)
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[http]", err);
    res.status(400).json({ error: err instanceof Error ? err.message : "request failed" });
  },
);

pruneForgotten();

app.listen(PORT, () => {
  console.log(`Group Chat Simulator server listening on http://localhost:${PORT}`);
});
