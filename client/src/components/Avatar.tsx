const PALETTE = [
  "#5865f2",
  "#23a559",
  "#f0b232",
  "#f23f43",
  "#eb459e",
  "#3498db",
  "#e67e22",
  "#9b59b6",
];

function hashColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function Avatar({
  name,
  url,
  seed,
  size = 40,
}: {
  name: string;
  url?: string | null;
  seed?: string;
  size?: number;
}) {
  const style = { width: size, height: size, minWidth: size, fontSize: size * 0.38 };
  if (url) {
    return <img src={url} alt={name} style={style} className="rounded-full object-cover" />;
  }
  return (
    <div
      style={{ ...style, background: hashColor(seed ?? name) }}
      className="flex items-center justify-center rounded-full font-semibold text-white select-none"
      title={name}
    >
      {name === "You" ? "🙂" : initials(name)}
    </div>
  );
}
