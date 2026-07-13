import { Router } from "express";
import { getApiKey, getModel, setSetting } from "../db.js";

export const settingsRouter = Router();

export const MODELS = ["claude-opus-4-8", "claude-sonnet-5", "claude-haiku-4-5"];

settingsRouter.get("/", (_req, res) => {
  res.json({
    model: getModel(),
    models: MODELS,
    has_api_key: Boolean(getApiKey()),
  });
});

settingsRouter.put("/", (req, res) => {
  const { api_key, model } = req.body ?? {};
  if (typeof api_key === "string" && api_key.trim()) {
    setSetting("api_key", api_key.trim());
  }
  if (typeof model === "string" && MODELS.includes(model)) {
    setSetting("model", model);
  }
  res.json({ model: getModel(), models: MODELS, has_api_key: Boolean(getApiKey()) });
});
