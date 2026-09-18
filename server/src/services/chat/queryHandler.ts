import type { ChatTable, ToolEvidence, ChatImage } from '../../types/chat.js';

export interface QueryResult {
  tables: ChatTable[];
  evidence: ToolEvidence;
  images?: ChatImage[];
}

export interface QueryHandler<TParams> {
  name: string;
  execute(params: TParams): Promise<QueryResult>;
}
