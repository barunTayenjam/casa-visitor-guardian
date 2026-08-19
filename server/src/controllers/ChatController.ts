import { Request, Response } from 'express';
import { ChatError, handleChatMessage } from '../services/chat/chatService.js';
import { logger } from '../utils/logger.js';
import { AppDataSource } from '../database.js';
import { ChatLog } from '../models/ChatLog.js';
import { ChatMessage, ChatRequest } from '../types/chat.js';

type AuthedUser = { userId: string; username?: string; role?: string };

function userIdOf(req: Request): string | null {
  return (req as Request & { user?: AuthedUser }).user?.userId ?? null;
}

async function persistMessage(
  userId: string,
  role: 'user' | 'assistant',
  content: string,
  extra: { tool?: string | null; params?: unknown } = {},
): Promise<void> {
  await AppDataSource.query(
    `INSERT INTO chat_messages (user_id, role, tool, params, content) VALUES ($1, $2, $3, $4, $5)`,
    [userId, role, extra.tool ?? null, extra.params ?? null, content],
  );
}

export const chatController = {
  async message(req: Request, res: Response): Promise<void> {
    try {
      const body = req.body as Partial<ChatRequest>;
      const message = typeof body.message === 'string' ? body.message : '';
      const rawHistory = Array.isArray(body.history) ? body.history : [];
      const history: ChatMessage[] = rawHistory
        .filter(
          (m): m is ChatMessage =>
            m &&
            typeof m === 'object' &&
            (m.role === 'user' || m.role === 'assistant') &&
            typeof m.content === 'string',
        )
        .slice(-10);

      const result = await handleChatMessage(message, history);

      const userId = userIdOf(req);
      if (userId) {
        try {
          await persistMessage(userId, 'user', message);
          await persistMessage(userId, 'assistant', result.answer.content, {
            tool: result.tool,
            params: result.params,
          });
        } catch (err) {
          logger.warn('Failed to persist chat message', 'CHAT', err);
        }
      }

      res.json({ success: true, data: result });
    } catch (err) {
      if (err instanceof ChatError) {
        res.status(err.status).json({ success: false, error: err.message });
        return;
      }
      logger.error('Chat message failed', 'CHAT', err);
      res.status(502).json({ success: false, error: 'AI service unavailable' });
    }
  },

  async history(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    try {
      const q = req.query as { limit?: string };
      const limit = Math.min(400, Math.max(1, parseInt(q.limit ?? '100', 10) || 100));
      const rows = await AppDataSource.getRepository(ChatLog).find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      });
      rows.reverse();
      res.json({
        success: true,
        data: {
          messages: rows.map((r) => ({
            id: r.id,
            role: r.role,
            content: r.content,
            tool: r.tool,
            params: r.params,
            createdAt: r.createdAt,
          })),
        },
      });
    } catch (err) {
      logger.error('Chat history failed', 'CHAT', err);
      res.status(500).json({ success: false, error: 'Failed to load chat history' });
    }
  },

  async clear(req: Request, res: Response): Promise<void> {
    const userId = userIdOf(req);
    if (!userId) {
      res.status(401).json({ success: false, error: 'Not authenticated' });
      return;
    }
    try {
      await AppDataSource.getRepository(ChatLog).delete({ userId });
      res.json({ success: true });
    } catch (err) {
      logger.error('Chat clear failed', 'CHAT', err);
      res.status(500).json({ success: false, error: 'Failed to clear chat history' });
    }
  },
};