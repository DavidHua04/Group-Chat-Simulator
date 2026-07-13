export interface Character {
  id: string;
  name: string;
  personality: string;
  background: string;
  avatar_url: string | null;
  is_friend: number;
  has_contact_info: number;
  relationship_to_user?: string;
}

export interface Group {
  id: string;
  name: string;
  allow_ai_chatter: number;
  members: Character[];
  message_count: number;
}

export interface Attachment {
  id: string;
  kind: "image" | "file";
  url: string;
  mime: string;
  original_name: string;
}

export interface Message {
  id: string;
  group_id: string;
  sender: string; // 'user' or character id
  sender_name: string;
  content: string;
  created_at: string;
  attachments: Attachment[];
}

export interface Settings {
  model: string;
  models: string[];
  has_api_key: boolean;
}

export interface NewMemberDraft {
  name: string;
  personality: string;
  background: string;
  relationship_to_user: string;
}
