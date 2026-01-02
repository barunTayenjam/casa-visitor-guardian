import EventEmitter from 'node:events';

export interface SecurityEvent {
  id?: string;
  type: 'motion' | 'face' | 'system' | 'camera' | 'visitor' | 'batch' | 'error';
  data: any;
  source?: string;
  timestamp?: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
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
      // Add timestamp and ID if not provided
      const enrichedEvent: SecurityEvent = {
        ...event,
        id: event.id || this.generateEventId(),
        timestamp: event.timestamp || new Date(),
        source: event.source || 'unknown',
        severity: event.severity || 'medium'
      };

      // Add to queue for processing
      if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
        console.warn('Event queue full, dropping oldest events');
        this.eventQueue.shift();
      }

      this.eventQueue.push(enrichedEvent);
      
      // Emit immediately for real-time handlers
      this.emit(event.type, enrichedEvent);
      this.emit('event', enrichedEvent);

      // Process queue asynchronously
      this.processQueue();

    } catch (error) {
      console.error('Failed to emit event:', error);
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
        // Schedule next processing batch
        setImmediate(() => this.processQueue());
      }

    } catch (error) {
      console.error('Error processing event queue:', error);
      this.emitError('Event queue processing failed', error);
    } finally {
      this.isProcessing = false;
    }
  }

  private async processEvent(event: SecurityEvent): Promise<void> {
    try {
      // Route to appropriate handlers
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
          console.warn(`Unknown event type: ${event.type}`);
      }
    } catch (error) {
      console.error(`Error processing event ${event.id}:`, error);
      this.emitError(`Event processing failed for ${event.type}`, error);
    }
  }

  private async handleMotionEvent(event: SecurityEvent): Promise<void> {
    // Motion detection logic
    this.emit('motion.processed', event);
    
    // Trigger additional processing if needed
    if (event.severity === 'high' || event.severity === 'critical') {
      this.emit('high_priority_motion', event);
    }
  }

  private async handleFaceEvent(event: SecurityEvent): Promise<void> {
    // Facial recognition logic
    this.emit('face.processed', event);
    
    // Store face recognition events for analytics
    if (event.data.confidence > 0.8) {
      this.emit('high_confidence_face', event);
    }
  }

  private async handleSystemEvent(event: SecurityEvent): Promise<void> {
    // System event logic
    this.emit('system.processed', event);
    
    // Handle critical system events
    if (event.severity === 'critical') {
      this.emit('critical_system_alert', event);
    }
  }

  private async handleCameraEvent(event: SecurityEvent): Promise<void> {
    // Camera-related events
    this.emit('camera.processed', event);
    
    // Handle camera offline events
    if (event.data.status === 'offline') {
      this.emit('camera_offline_alert', event);
    }
  }

  private async handleVisitorEvent(event: SecurityEvent): Promise<void> {
    // Visitor tracking logic
    this.emit('visitor.processed', event);
    
    // Handle unauthorized visitor events
    if (event.data.authorizationStatus === 'unauthorized') {
      this.emit('unauthorized_visitor_alert', event);
    }
  }

  private async handleBatchEvent(event: SecurityEvent): Promise<void> {
    // Batch processing events
    this.emit('batch.processed', event);
    
    // Handle batch completion events
    if (event.data.status === 'completed') {
      this.emit('batch_completed', event);
    }
  }

  private async handleErrorEvent(event: SecurityEvent): Promise<void> {
    // Error handling logic
    this.emit('error.processed', event);
    
    // Handle critical errors
    if (event.severity === 'critical') {
      this.emit('critical_error_alert', event);
    }
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private emitError(message: string, error: any): void {
    this.emitEvent({
      type: 'error',
      data: {
        message,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      },
      source: 'EventBus',
      severity: 'medium'
    });
  }

  private setupErrorHandling(): void {
    this.on('error', (error) => {
      console.error('EventBus critical error:', error);
    });

    // Handle process exit
    process.on('beforeExit', () => {
      console.log(`EventBus shutting down with ${this.eventQueue.length} events in queue`);
    });

    process.on('uncaughtException', (error) => {
      console.error('EventBus uncaught exception:', error);
      this.emitError('Uncaught exception in EventBus', error);
    });
  }

  // Public methods for monitoring and management
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
    console.log('EventBus queue cleared');
  }

  // Method to register event handlers with better typing
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