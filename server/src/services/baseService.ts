import EventBus from '../events/eventBus.js';

export abstract class BaseService {
  protected eventBus: EventBus;
  protected serviceName: string;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.eventBus = EventBus.getInstance();
    this.setupEventHandlers();
  }

  protected abstract setupEventHandlers(): void;

  protected async emitServiceEvent(type: string, data: any, source?: string): Promise<void> {
    await this.eventBus.emitEvent({
      type: type as any,
      data,
      source: source || this.serviceName,
      timestamp: new Date()
    });
  }

  protected logError(error: Error, context?: any): void {
    console.error(`[${this.serviceName}] Error:`, {
      message: error.message,
      stack: error.stack,
      context
    });
  }

  protected logInfo(message: string, data?: any): void {
    console.info(`[${this.serviceName}] ${message}`, data);
  }

  protected logWarn(message: string, data?: any): void {
    console.warn(`[${this.serviceName}] ${message}`, data);
  }

  protected logDebug(message: string, data?: any): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[${this.serviceName}] ${message}`, data);
    }
  }

  // Helper method to emit structured events
  protected async emitStructuredEvent<T extends keyof ServiceEventMap>(
    eventType: T,
    data: ServiceEventMap[T],
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<void> {
    await this.eventBus.emitEvent({
      type: this.mapEventType(eventType),
      data,
      source: this.serviceName,
      severity,
      timestamp: new Date()
    });
  }

  private mapEventType(eventType: keyof ServiceEventMap): SecurityEvent['type'] {
    const mapping: Record<keyof ServiceEventMap, SecurityEvent['type']> = {
      motionDetected: 'motion',
      faceRecognized: 'face',
      cameraOffline: 'camera',
      visitorEntry: 'visitor',
      batchCompleted: 'batch',
      systemError: 'error',
      systemStarted: 'system',
      processingError: 'error'
    };
    return mapping[eventType] || 'system';
  }
}

// Event type definitions for better type safety
export interface ServiceEventMap {
  motionDetected: {
    cameraId: string;
    confidence: number;
    timestamp: Date;
    imagePath?: string;
  };
  faceRecognized: {
    cameraId: string;
    personName?: string;
    confidence: number;
    timestamp: Date;
    imagePath?: string;
  };
  cameraOffline: {
    cameraId: string;
    reason: string;
    timestamp: Date;
  };
  visitorEntry: {
    name?: string;
    eventType: 'entry' | 'exit' | 'delivery';
    timestamp: Date;
    confidence?: number;
    imagePath?: string;
  };
  batchCompleted: {
    operationType: string;
    processed: number;
    success: boolean;
    duration: number;
    timestamp: Date;
  };
  systemError: {
    component: string;
    error: string;
    timestamp: Date;
  };
  systemStarted: {
    version: string;
    timestamp: Date;
  };
  processingError: {
    operation: string;
    error: string;
    timestamp: Date;
  };
}

export interface SecurityEvent {
  id?: string;
  type: 'motion' | 'face' | 'system' | 'camera' | 'visitor' | 'batch' | 'error';
  data: any;
  source?: string;
  timestamp?: Date;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

// Export EventBus for use in services
export { EventBus };