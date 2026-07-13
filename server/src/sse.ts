import type { Request, Response } from "express";

const channels = new Map<string, Set<Response>>();

export function subscribe(groupId: string, req: Request, res: Response): void {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write(": connected\n\n");

  let set = channels.get(groupId);
  if (!set) {
    set = new Set();
    channels.set(groupId, set);
  }
  set.add(res);

  req.on("close", () => {
    set!.delete(res);
    if (set!.size === 0) channels.delete(groupId);
  });
}

export function broadcast(groupId: string, event: string, data: unknown): void {
  const set = channels.get(groupId);
  if (!set) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) res.write(payload);
}

// keep connections alive through proxies
setInterval(() => {
  for (const set of channels.values()) {
    for (const res of set) res.write(": ping\n\n");
  }
}, 25_000).unref();
