import type { Character, Group, Message, NewMemberDraft, Settings } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  settings: {
    get: () => req<Settings>("/api/settings"),
    update: (body: { api_key?: string; model?: string }) =>
      req<Settings>("/api/settings", json("PUT", body)),
  },
  characters: {
    list: () => req<Character[]>("/api/characters"),
    create: (body: Omit<Partial<Character>, "is_friend"> & { name: string; is_friend?: boolean }) =>
      req<Character>("/api/characters", json("POST", body)),
    update: (id: string, body: Partial<Character>) =>
      req<Character>(`/api/characters/${id}`, json("PUT", body)),
    setFriend: (id: string, isFriend: boolean) =>
      req<Character>(`/api/characters/${id}/friend`, json("POST", { is_friend: isFriend })),
    uploadAvatar: (id: string, file: File) => {
      const fd = new FormData();
      fd.append("avatar", file);
      return req<Character>(`/api/characters/${id}/avatar`, { method: "POST", body: fd });
    },
  },
  groups: {
    list: () => req<Group[]>("/api/groups"),
    create: (body: {
      name: string;
      allow_ai_chatter: boolean;
      existing_member_ids: string[];
      new_members: NewMemberDraft[];
    }) => req<Group>("/api/groups", json("POST", body)),
    update: (id: string, body: { name?: string; allow_ai_chatter?: boolean }) =>
      req<Group>(`/api/groups/${id}`, json("PATCH", body)),
    addMember: (id: string, characterId: string) =>
      req<Group>(`/api/groups/${id}/members`, json("POST", { character_id: characterId })),
  },
  messages: {
    list: (groupId: string) => req<Message[]>(`/api/groups/${groupId}/messages`),
    send: (groupId: string, content: string, files: File[]) => {
      const fd = new FormData();
      fd.append("content", content);
      for (const f of files) fd.append("files", f);
      return req<Message>(`/api/groups/${groupId}/messages`, { method: "POST", body: fd });
    },
  },
};
