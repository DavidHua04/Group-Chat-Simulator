import type { ReactNode } from "react";

export default function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`flex max-h-[90vh] w-full ${wide ? "max-w-2xl" : "max-w-md"} flex-col overflow-hidden rounded-lg bg-[#313338] shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[#26272b] px-5 py-4">
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded px-2 text-2xl leading-none text-[#949ba4] hover:text-white"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="mb-4 block">
      <div className="mb-1 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-[#949ba4]">{hint}</div>}
    </label>
  );
}

export const inputCls =
  "w-full rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#dbdee1] outline-none placeholder:text-[#6d6f78] focus:ring-1 focus:ring-[#5865f2]";

export const btnPrimary =
  "rounded bg-[#5865f2] px-4 py-2 text-sm font-medium text-white hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-50";

export const btnGhost =
  "rounded px-4 py-2 text-sm font-medium text-[#dbdee1] hover:underline";

export const btnDanger =
  "rounded bg-[#da373c] px-4 py-2 text-sm font-medium text-white hover:bg-[#a12828]";
