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

export interface ChatHistoryEntry {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  tool: string | null;
  params: Record<string, unknown> | null;
  createdAt: string;
}

export async function fetchChatHistory(limit = 200): Promise<ChatHistoryEntry[]> {
  const res = await fetchWithRetry(`${API_URL}/chat/history?limit=${limit}`);
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to load chat history');
  return json.data.messages;
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetchWithRetry(`${API_URL}/chat/history`, { method: 'DELETE' });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Failed to clear chat history');
}