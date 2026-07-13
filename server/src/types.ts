export interface CharacterRow {
  id: string;
  name: string;
  personality: string;
  background: string;
  avatar_path: string | null;
  is_friend: number;
  has_contact_info: number;
  created_at: string;
}

export interface GroupRow {
  id: string;
  name: string;
  allow_ai_chatter: number;
  memory_checkpoint: number;
  created_at: string;
}

export interface RelationshipRow {
  id: string;
  character_id: string;
  target: string; // 'user' or a character id
  description: string;
}

export interface MessageRow {
  id: string;
  group_id: string;
  sender: string; // 'user' or a character id
  content: string;
  created_at: string;
}

export interface AttachmentRow {
  id: string;
  message_id: string;
  kind: "image" | "file";
  path: string; // filename inside uploads dir
  mime: string;
  original_name: string;
}

export interface MemoryRow {
  id: string;
  character_id: string;
  group_id: string;
  content: string;
  participant_ids: string; // JSON array of character ids
  participated: number;
  created_at: string;
}

export interface SerializedAttachment {
  id: string;
  kind: "image" | "file";
  url: string;
  mime: string;
  original_name: string;
}

export interface SerializedMessage {
  id: string;
  group_id: string;
  sender: string;
  sender_name: string;
  content: string;
  created_at: string;
  attachments: SerializedAttachment[];
}
