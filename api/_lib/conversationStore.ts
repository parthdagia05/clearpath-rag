export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  document_id: string;
  turns: ChatTurn[];
  updated_at: number;
}

const MAX_TURNS = 8;
const TTL_MS = 60 * 60 * 1000;
const MAX_CONVERSATIONS = 200;

const conversations = new Map<string, Conversation>();

export function generateConversationId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'conv_';
  for (let i = 0; i < 8; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}

export function appendTurn(
  conversationId: string,
  documentId: string,
  turn: ChatTurn
): void {
  evictExpired();
  let conv = conversations.get(conversationId);
  if (!conv || conv.document_id !== documentId) {
    conv = { document_id: documentId, turns: [], updated_at: Date.now() };
    conversations.set(conversationId, conv);
  }
  conv.turns.push(turn);
  if (conv.turns.length > MAX_TURNS) {
    conv.turns = conv.turns.slice(-MAX_TURNS);
  }
  conv.updated_at = Date.now();
  if (conversations.size > MAX_CONVERSATIONS) {
    let oldestId: string | null = null;
    let oldestAt = Infinity;
    for (const [id, c] of conversations) {
      if (c.updated_at < oldestAt) {
        oldestAt = c.updated_at;
        oldestId = id;
      }
    }
    if (oldestId) conversations.delete(oldestId);
  }
}

export function getHistory(conversationId: string, documentId: string): ChatTurn[] {
  evictExpired();
  const conv = conversations.get(conversationId);
  if (!conv || conv.document_id !== documentId) return [];
  return conv.turns;
}

export function resetConversation(conversationId: string): void {
  conversations.delete(conversationId);
}

function evictExpired(): void {
  const now = Date.now();
  for (const [id, c] of conversations) {
    if (now - c.updated_at > TTL_MS) conversations.delete(id);
  }
}
