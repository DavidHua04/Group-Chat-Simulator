import { useState } from "react";
import { api } from "../api";
import Modal, { Field, btnGhost, btnPrimary, inputCls } from "./Modal";
import type { Settings } from "../types";

export default function SettingsModal({
  settings,
  onSaved,
  onClose,
}: {
  settings: Settings;
  onSaved: (s: Settings) => void;
  onClose: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(settings.model);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.settings.update({
        ...(apiKey.trim() ? { api_key: apiKey.trim() } : {}),
        model,
      });
      onSaved(next);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Settings" onClose={onClose}>
      <Field
        label="Anthropic API key"
        hint={
          settings.has_api_key
            ? "A key is already configured — enter a new one only to replace it. Bring your own key (BYOK): usage is billed to your Anthropic account."
            : "Required before characters can talk. Get one at console.anthropic.com. Stored locally on your machine only."
        }
      >
        <input
          type="password"
          className={inputCls}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={settings.has_api_key ? "•••••••••••••• (saved)" : "sk-ant-…"}
        />
      </Field>

      <Field
        label="Model"
        hint="Every character reply is one model call. Smaller models are cheaper and faster; larger ones roleplay better."
      >
        <select className={inputCls} value={model} onChange={(e) => setModel(e.target.value)}>
          {settings.models.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </Field>

      {error && <p className="mb-3 text-sm text-[#f23f43]">{error}</p>}

      <div className="flex justify-end gap-2 pb-1">
        <button className={btnGhost} onClick={onClose}>
          Cancel
        </button>
        <button className={btnPrimary} onClick={() => void save()} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}
