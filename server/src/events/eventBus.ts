import { EventEmitter } from 'node:events';
import { logger } from '../utils/logger.js';
import type { TrackingEvent, DetectionEvent, SystemEvent } from '../types/events.js';

export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(100);
  }

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  emitTracking(payload: TrackingEvent): boolean {
    return this.emit('tracking', payload);
  }

  onTracking(handler: (payload: TrackingEvent) => void): this {
    return this.on('tracking', handler);
  }

  emitDetection(payload: DetectionEvent): boolean {
    return this.emit('detection', payload);
  }

  onDetection(handler: (payload: DetectionEvent) => void): this {
    return this.on('detection', handler);
  }

  emitSystem(payload: SystemEvent): boolean {
    return this.emit('system', payload);
  }

  onSystem(handler: (payload: SystemEvent) => void): this {
    return this.on('system', handler);
  }
}

export const eventBus = EventBus.getInstance();
