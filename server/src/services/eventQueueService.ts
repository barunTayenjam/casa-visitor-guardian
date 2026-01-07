import { AppDataSource } from '../database.js';
import { MotionEvent } from '../detection/simpleMotionDetection.js';

export class EventQueueService {
  private static instance: EventQueueService;
  private processing = false;
  private socket: any;

  static getInstance(): EventQueueService {
    if (!EventQueueService.instance) {
      EventQueueService.instance = new EventQueueService();
    }
    return EventQueueService.instance;
  }

  setSocket(socket: any): void {
    this.socket = socket;
  }

  async enqueueEvent(event: MotionEvent, eventType: string = 'motion'): Promise<void> {
    const query = `
      INSERT INTO event_queue (event_type, event_data, camera_id, priority, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `;
    await AppDataSource.query(query, [
      eventType,
      JSON.stringify(event),
      event.cameraId,
      eventType === 'motion' ? 1 : 0
    ]);
  }

  async dequeueEvent(): Promise<MotionEvent | null> {
    const query = `
      WITH event_to_process AS (
        SELECT id, event_data
        FROM event_queue
        WHERE status = 'pending'
        ORDER BY priority DESC, created_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE event_queue
      SET status = 'processing', processed_at = NOW()
      WHERE id = (SELECT id FROM event_to_process)
      RETURNING id, event_data
    `;

    const result = await AppDataSource.query(query);
    if (result.length > 0) {
      const eventId = result[0].id;
      const eventData = result[0].event_data as MotionEvent;

      try {
        if (this.socket) {
          this.socket.emit('motion', eventData);
        }

        await this.markEventCompleted(eventId, true);
        return eventData;
      } catch (error) {
        console.error(`EventQueueService: Failed to process event ${eventId}:`, error);
        await this.markEventCompleted(eventId, false, error instanceof Error ? error.message : 'Unknown error');
        return null;
      }
    }
    return null;
  }

  async markEventCompleted(eventId: string, success: boolean, error?: string): Promise<void> {
    const query = `
      UPDATE event_queue
      SET status = $1, error_message = $2
      WHERE id = $3
    `;
    await AppDataSource.query(query, [
      success ? 'completed' : 'failed',
      error || null,
      eventId
    ]);
  }

  async getRecentEvents(limit: number = 100): Promise<MotionEvent[]> {
    const query = `
      SELECT event_data
      FROM event_queue
      WHERE status = 'completed'
      ORDER BY processed_at DESC
      LIMIT $1
    `;
    const result = await AppDataSource.query(query, [limit]);
    return result.map((r: any) => r.event_data as MotionEvent);
  }

  async replayPendingEvents(): Promise<number> {
    const query = `
      UPDATE event_queue
      SET status = 'pending'
      WHERE status IN ('processing', 'failed')
        AND processed_at < NOW() - INTERVAL '5 minutes'
      RETURNING id
    `;
    const result = await AppDataSource.query(query);
    return result.length;
  }

  startProcessing(): void {
    if (this.processing) return;
    this.processing = true;

    const processBatch = async () => {
      try {
        let eventProcessed = false;
        let count = 0;

        while (count < 10) {
          const event = await this.dequeueEvent();
          if (!event) {
            break;
          }
          eventProcessed = true;
          count++;
        }

        if (eventProcessed) {
          console.log(`EventQueueService: Processed ${count} events`);
        }
      } catch (error) {
        console.error('EventQueueService: Processing error:', error);
      }
      setTimeout(processBatch, 1000);
    };

    processBatch();
  }

  stopProcessing(): void {
    this.processing = false;
  }

  async getQueueStats(): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
    const query = `
      SELECT status, COUNT(*) as count
      FROM event_queue
      GROUP BY status
    `;
    const result = await AppDataSource.query(query);

    const stats = { pending: 0, processing: 0, completed: 0, failed: 0 };
    for (const row of result) {
      if (row.status in stats) {
        stats[row.status as keyof typeof stats] = parseInt(row.count);
      }
    }
    return stats;
  }
}

export const eventQueueService = EventQueueService.getInstance();
