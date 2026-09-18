import type { QueryHandler, QueryResult } from './queryHandler.js';

export class QueryRegistry {
  private handlers = new Map<string, QueryHandler<any>>();

  register<TParams>(handler: QueryHandler<TParams>): void {
    this.handlers.set(handler.name, handler);
  }

  async execute<TParams>(name: string, params: TParams): Promise<QueryResult> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Unknown query handler: ${name}`);
    }
    return handler.execute(params);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const queryRegistry = new QueryRegistry();
