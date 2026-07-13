import { useEffect, useRef } from "react";
import type { Message } from "./types";

export interface TypingEvent {
  characterId: string;
  name: string;
  state: "start" | "stop";
}

export interface DeltaEvent {
  characterId: string;
  text: string;
}

export interface StreamHandlers {
  onMessage: (m: Message) => void;
  onTyping: (e: TypingEvent) => void;
  onDelta: (e: DeltaEvent) => void;
  onError: (message: string) => void;
}

export function useGroupStream(groupId: string | null, handlers: StreamHandlers): void {
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!groupId) return;
    const es = new EventSource(`/api/groups/${groupId}/stream`);

    es.addEventListener("message", (ev) => {
      ref.current.onMessage(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("typing", (ev) => {
      ref.current.onTyping(JSON.parse((ev as MessageEvent).data));
    });
    es.addEventListener("delta", (ev) => {
      ref.current.onDelta(JSON.parse((ev as MessageEvent).data));
    });
    // server-sent chat errors carry data; bare EventSource connection errors don't
    es.addEventListener("error", (ev) => {
      const data = (ev as MessageEvent).data;
      if (data) {
        try {
          ref.current.onError(JSON.parse(data).message ?? "Something went wrong.");
        } catch {
          /* ignore malformed */
        }
      }
    });

    return () => es.close();
  }, [groupId]);
}
