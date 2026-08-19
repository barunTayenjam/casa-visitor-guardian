export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
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

export interface ChatAnswer {
  type: 'markdown';
  content: string;
}

export interface ChatResponse {
  tool: string;
  params: Record<string, unknown>;
  answer: ChatAnswer;
  tables: ChatTable[];
  evidence: ChatEvidence;
  /** Coverage caveat; empty for fallback answers. */
  caveat: string;
}

export type ToolName = 'vehicle_timeline' | 'human_counts' | 'period_report' | 'fallback';