import { useRef, useState } from "react";

export default function Composer({
  groupName,
  onSend,
  onError,
}: {
  groupName: string;
  onSend: (content: string, files: File[]) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const submit = async () => {
    const content = text.trim();
    if ((!content && files.length === 0) || sending) return;
    setSending(true);
    try {
      await onSend(content, files);
      setText("");
      setFiles([]);
      if (fileInput.current) fileInput.current.value = "";
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to send.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pb-5">
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {files.map((f, i) => (
            <span
              key={i}
              className="flex items-center gap-2 rounded bg-[#2b2d31] px-2 py-1 text-xs text-[#dbdee1]"
            >
              {f.type.startsWith("image/") ? "🖼️" : "📎"} {f.name}
              <button
                className="text-[#949ba4] hover:text-white"
                onClick={() => setFiles(files.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex items-end gap-2 rounded-lg bg-[#383a40] px-3 py-2">
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? []);
            setFiles((prev) => [...prev, ...chosen].slice(0, 5));
          }}
        />
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#b5bac1] hover:text-white"
          onClick={() => fileInput.current?.click()}
          title="Attach an image or file"
        >
          ➕
        </button>
        <textarea
          rows={1}
          value={text}
          placeholder={`Message #${groupName}`}
          className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm text-[#dbdee1] outline-none placeholder:text-[#6d6f78]"
          onChange={(e) => {
            setText(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full text-xl text-[#b5bac1] hover:text-white disabled:opacity-40"
          onClick={() => void submit()}
          disabled={sending || (!text.trim() && files.length === 0)}
          title="Send"
        >
          ➤
        </button>
      </div>
    </div>
  );
}
