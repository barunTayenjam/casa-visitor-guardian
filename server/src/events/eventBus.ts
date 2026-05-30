import EventEmitter from 'node:events';
import { logger } from '../utils/logger.js';

export interface MotionEventData {
  cameraId?: string;
  confidence?: number;
  detections?: Array<{ class: string; confidence: number; bbox: { x: number; y: number; width: number; height: number } }>;
  labels?: string[];
  [key: string]: unknown;
}

export interface FaceEventData {
  cameraId?: string;
  confidence?: number;
  faces?: Array<{ id: string; name: string; confidence: number; isKnown: boolean }>;
  [key: string]: unknown;
}

export interface SystemEventData {
  message?: string;
  status?: string;
  [key: string]: unknown;
}

export interface CameraEventData {
  cameraId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface VisitorEventData {
  visitorId?: string;
  authorizationStatus?: string;
  [key: string]: unknown;
}

export interface BatchEventData {
  jobId?: string;
  status?: string;
  [key: string]: unknown;
}

export interface ErrorEventData {
  message: string;
  error?: string;
  stack?: string;
}

export type EventData = MotionEventData | FaceEventData | SystemEventData | CameraEventData | VisitorEventData | BatchEventData | ErrorEventData | Record<string, unknown>;

export interface SecurityEvent {
  id?: string;
  type: 'motion' | 'face' | 'system' | 'camera' | 'visitor' | 'batch' | 'error';
  data: EventData;
  source?: string;
  timestamp?: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
}

export interface EventHandlers {
  motion?: (event: SecurityEvent) => Promise<void>;
  face?: (event: SecurityEvent) => Promise<void>;
  system?: (event: SecurityEvent) => Promise<void>;
  camera?: (event: SecurityEvent) => Promise<void>;
  visitor?: (event: SecurityEvent) => Promise<void>;
  batch?: (event: SecurityEvent) => Promise<void>;
  error?: (event: SecurityEvent) => Promise<void>;
}

export class EventBus extends EventEmitter {
  private static instance: EventBus;
  private eventQueue: SecurityEvent[] = [];
  private isProcessing = false;
  private _isEmittingError = false;
  private readonly MAX_QUEUE_SIZE = 1000;
  private readonly PROCESSING_BATCH_SIZE = 50;

  private constructor() {
    super();
    this.setMaxListeners(50);
    this.setupErrorHandling();
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  async emitEvent(event: SecurityEvent): Promise<void> {
    try {
      const enrichedEvent: SecurityEvent = {
        ...event,
        id: event.id || this.generateEventId(),
        timestamp: event.timestamp || new Date(),
        source: event.source || 'unknown',
        severity: event.severity || 'medium'
      };

      if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
        logger.warn('Event queue full, dropping oldest events', 'EventBus');
        this.eventQueue.shift();
      }

      this.eventQueue.push(enrichedEvent);
      
      this.emit(event.type, enrichedEvent);
      this.emit('event', enrichedEvent);

      this.processQueue();

    } catch (error) {
      logger.error('Failed to emit event', 'EventBus', error);
      this.emitError('Event emission failed', error);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      let processedCount = 0;
      
      while (this.eventQueue.length > 0 && processedCount < this.PROCESSING_BATCH_SIZE) {
        const event = this.eventQueue.shift()!;
        await this.processEvent(event);
        processedCount++;
      }

      if (this.eventQueue.length > 0) {
        setImmediate(() => this.processQueue());
      }

    } catch (error) {
      logger.error('Error processing event queue', 'EventBus', error);
      this.emitError('Event queue processing failed', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: SecurityEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'motion':
          await this.handleMotionEvent(event);
          break;
        case 'face':
          await this.handleFaceEvent(event);
          break;
        case 'system':
          await this.handleSystemEvent(event);
          break;
        case 'camera':
          await this.handleCameraEvent(event);
          break;
        case 'visitor':
          await this.handleVisitorEvent(event);
          break;
        case 'batch':
          await this.handleBatchEvent(event);
          break;
        case 'error':
          await this.handleErrorEvent(event);
          break;
        default:
          logger.warn(`Unknown event type: ${event.type}`, 'EventBus');
      }
    } catch (error) {
      logger.error(`Error processing event ${event.id}`, 'EventBus', error);
      this.emitError(`Event processing failed for ${event.type}`, error);
    }
  }

  private async handleMotionEvent(event: SecurityEvent): Promise<void> {
    this.emit('motion.processed', event);
    
    if (event.severity === 'high' || event.severity === 'critical') {
      this.emit('high_priority_motion', event);
    }
  }

  private async handleFaceEvent(event: SecurityEvent): Promise<void> {
    this.emit('face.processed', event);
    
    const data = event.data as FaceEventData;
    if (data.confidence && data.confidence > 0.8) {
      this.emit('high_confidence_face', event);
    }
  }

  private async handleSystemEvent(event: SecurityEvent): Promise<void> {
    this.emit('system.processed', event);
    
    if (event.severity === 'critical') {
      this.emit('critical_system_alert', event);
    }
  }

  private async handleCameraEvent(event: SecurityEvent): Promise<void> {
    this.emit('camera.processed', event);
    
    const data = event.data as CameraEventData;
    if (data.status === 'offline') {
      this.emit('camera_offline_alert', event);
    }
  }

  private async handleVisitorEvent(event: SecurityEvent): Promise<void> {
    this.emit('visitor.processed', event);
    
    const data = event.data as VisitorEventData;
    if (data.authorizationStatus === 'unauthorized') {
      this.emit('unauthorized_visitor_alert', event);
    }
  }

  private async handleBatchEvent(event: SecurityEvent): Promise<void> {
    this.emit('batch.processed', event);
    
    const data = event.data as BatchEventData;
    if (data.status === 'completed') {
      this.emit('batch_completed', event);
    }
  }

  private async handleErrorEvent(event: SecurityEvent): Promise<void> {
    this.emit('error.processed', event);
    
    if (event.severity === 'critical') {
      this.emit('critical_error_alert', event);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitError(message: string, error: unknown): void {
    if (this._isEmittingError) {
      logger.error(`EventBus: error during error emission (suppressed): ${message}`, 'EventBus', error);
      return;
    }
    this._isEmittingError = true;
    try {
      this.emitEvent({
        type: 'error',
        data: { message, error: error instanceof Error ? error.message : String(error) },
        source: 'EventBus',
        severity: 'medium',
      });
    } finally {
      this._isEmittingError = false;
    }
  }

  private setupErrorHandling(): void {
    this.on('error', (error: unknown) => {
      logger.error('EventBus critical error', 'EventBus', error);
    });

    process.on('beforeExit', () => {
      logger.info(`EventBus shutting down with ${this.eventQueue.length} events in queue`, 'EventBus');
    });

    process.on('uncaughtException', (error: unknown) => {
      logger.error('EventBus uncaught exception', 'EventBus', error);
      this.emitError('Uncaught exception in EventBus', error);
    });
  }

  getQueueStats(): {
    queueLength: number;
    isProcessing: boolean;
    maxQueueSize: number;
  } {
    return {
      queueLength: this.eventQueue.length,
      isProcessing: this.isProcessing,
      maxQueueSize: this.MAX_QUEUE_SIZE
    };
  }

  async clearQueue(): Promise<void> {
    this.eventQueue = [];
  }

  registerHandlers(handlers: EventHandlers): void {
    if (handlers.motion) {
      this.on('motion', handlers.motion);
    }
    if (handlers.face) {
      this.on('face', handlers.face);
    }
    if (handlers.system) {
      this.on('system', handlers.system);
    }
    if (handlers.camera) {
      this.on('camera', handlers.camera);
    }
    if (handlers.visitor) {
      this.on('visitor', handlers.visitor);
    }
    if (handlers.batch) {
      this.on('batch', handlers.batch);
    }
    if (handlers.error) {
      this.on('error', handlers.error);
    }
  }
}

export default EventBus;