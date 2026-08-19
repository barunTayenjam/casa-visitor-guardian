import { fetchWithRetry, API_URL } from './baseClient';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatTable {
  caption?: string;
  headers: string[];
  rows: Array<(string | number | null)[]>;
}

export interface ChatEvidence {
  detections: number;
  events: number;
  cameras: string[];
  window: string;
}

export interface ChatResponse {
  tool: string;
  params: Record<string, unknown>;
  answer: { type: 'markdown'; content: string };
  tables: ChatTable[];
  evidence: ChatEvidence;
  caveat: string;
}

export async function sendChatMessage(
  message: string,
  history: ChatMessage[] = [],
): Promise<ChatResponse> {
  const res = await fetchWithRetry(`${API_URL}/chat/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history }),
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Chat request failed');
  return json.data;
}