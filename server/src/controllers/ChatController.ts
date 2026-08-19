import { Request, Response } from 'express';
import { ChatError, handleChatMessage } from '../services/chat/chatService.js';
import { logger } from '../utils/logger.js';
import { ChatMessage, ChatRequest } from '../types/chat.js';

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
};