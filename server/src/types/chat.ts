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

/** Evidence produced by query tools; chatService attaches the window label. */
export interface ToolEvidence {
  detections: number;
  events: number;
  cameras: string[];
  /** Estimated distinct object visits (tracker IDs merged across short gaps). */
  sessions?: number;
  /** Raw distinct track IDs behind the sessions estimate. */
  tracks?: number;
}

export interface ChatEvidence extends ToolEvidence {
  window: string;
}

export interface ChatAnswer {
  type: 'markdown';
  content: string;
}

/** Snapshot attached to an answer so the user can see what was detected. */
export interface ChatImage {
  url: string;
  caption: string;
}

export interface ChatResponse {
  tool: string;
  params: Record<string, unknown>;
  answer: ChatAnswer;
  tables: ChatTable[];
  evidence: ChatEvidence;
  /** Caveat shown under the answer; empty for fallback answers. */
  caveat: string;
  images?: ChatImage[];
}

export type ToolName =
  | 'vehicle_timeline'
  | 'human_counts'
  | 'period_report'
  | 'camera_activity'
  | 'event_correlation'
  | 'anomalies'
  | 'fallback';