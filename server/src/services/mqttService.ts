import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export interface DetectionEvent {
  cameraId: string;
  cameraName: string;
  timestamp: string;
  labels: string[];
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  zone?: string;
}

export interface MotionEvent {
  cameraId: string;
  cameraName: string;
  timestamp: string;
  intensity: number;
}

export class MQTTService {
  private client: MqttClient | null = null;
  private connected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  private baseTopic: string;

  constructor() {
    this.baseTopic = config.mqtt?.topicPrefix || 'sentryvision';
  }

  async connect(): Promise<boolean> {
    const brokerUrl = config.mqtt?.host;
    
    if (!brokerUrl) {
      logger.info('MQTT broker not configured, skipping connection', 'MQTT');
      return false;
    }

    return new Promise((resolve) => {
      const options: IClientOptions = {
        clientId: `sentryvision_${Math.random().toString(16).slice(2, 10)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
        username: config.mqtt?.user,
        password: config.mqtt?.password,
      };

      logger.info(`Connecting to MQTT broker at ${brokerUrl}`, 'MQTT');

      try {
        this.client = mqtt.connect(brokerUrl, options);

        this.client.on('connect', () => {
          logger.info('Connected to MQTT broker', 'MQTT');
          this.connected = true;
          this.reconnectAttempts = 0;
          resolve(true);
        });

        this.client.on('error', (error) => {
          logger.error(`MQTT connection error: ${error.message}`, 'MQTT');
          if (!this.connected) {
            resolve(false);
          }
        });

        this.client.on('close', () => {
          if (this.connected) {
            logger.warn('MQTT connection closed', 'MQTT');
          }
          this.connected = false;
        });

        this.client.on('reconnect', () => {
          this.reconnectAttempts++;
          logger.info(`MQTT reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`, 'MQTT');
          
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('MQTT max reconnect attempts reached', 'MQTT');
            this.client?.end();
            this.client = null;
          }
        });

        // Set a timeout for initial connection
        setTimeout(() => {
          if (!this.connected) {
            logger.warn('MQTT connection timeout', 'MQTT');
            resolve(false);
          }
        }, 10000);

      } catch (error) {
        logger.error(`Failed to connect to MQTT broker: ${error}`, 'MQTT');
        resolve(false);
      }
    });
  }

  disconnect(): void {
    if (this.client) {
      this.client.end();
      this.client = null;
      this.connected = false;
      logger.info('Disconnected from MQTT broker', 'MQTT');
    }
  }

  isConnected(): boolean {
    return this.connected && this.client !== null;
  }

  private publish(topic: string, payload: any, retain: boolean = false): void {
    if (!this.connected || !this.client) {
      logger.warn(`MQTT not connected, skipping publish to ${topic}`, 'MQTT');
      return;
    }

    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    this.client.publish(topic, message, { retain }, (error) => {
      if (error) {
        logger.error(`MQTT publish error on ${topic}: ${error.message}`, 'MQTT');
      } else {
        logger.debug(`Published to ${topic}`, 'MQTT');
      }
    });
  }

  // Publish detection events
  publishDetection(event: DetectionEvent): void {
    const topic = `${this.baseTopic}/${event.cameraId}/detection`;
    this.publish(topic, {
      cameraId: event.cameraId,
      cameraName: event.cameraName,
      timestamp: event.timestamp,
      labels: event.labels,
      confidence: event.confidence,
      boundingBox: event.boundingBox,
      zone: event.zone
    });
  }

  // Publish motion events
  publishMotion(event: MotionEvent): void {
    const topic = `${this.baseTopic}/${event.cameraId}/motion`;
    this.publish(topic, {
      cameraId: event.cameraId,
      cameraName: event.cameraName,
      timestamp: event.timestamp,
      intensity: event.intensity
    });
  }

  // Publish camera status changes
  publishCameraStatus(cameraId: string, status: 'online' | 'offline' | 'error'): void {
    const topic = `${this.baseTopic}/${cameraId}/status`;
    this.publish(topic, {
      cameraId,
      status,
      timestamp: new Date().toISOString()
    }, true);
  }

  // Publish zone alerts
  publishZoneAlert(cameraId: string, zoneId: string, zoneName: string, event: DetectionEvent): void {
    const topic = `${this.baseTopic}/${cameraId}/zones/${zoneId}/alert`;
    this.publish(topic, {
      cameraId,
      cameraName: event.cameraName,
      zoneId,
      zoneName,
      timestamp: event.timestamp,
      labels: event.labels,
      confidence: event.confidence
    });
  }

  // Publish snapshot availability
  publishSnapshot(cameraId: string, snapshotPath: string): void {
    const topic = `${this.baseTopic}/${cameraId}/snapshot`;
    this.publish(topic, {
      cameraId,
      snapshotPath,
      timestamp: new Date().toISOString()
    });
  }

  // Subscribe to a topic (for receiving commands)
  subscribe(topic: string, callback: (message: string) => void): void {
    if (!this.connected || !this.client) {
      logger.warn('MQTT not connected, cannot subscribe', 'MQTT');
      return;
    }

    this.client.subscribe(topic, (error) => {
      if (error) {
        logger.error(`MQTT subscribe error for ${topic}: ${error.message}`, 'MQTT');
      } else {
        logger.info(`Subscribed to ${topic}`, 'MQTT');
      }
    });

    this.client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        callback(message.toString());
      }
    });
  }

  // Get connection status for health checks
  getStatus(): { connected: boolean; reconnectAttempts: number } {
    return {
      connected: this.connected,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Singleton instance
let mqttService: MQTTService | null = null;

export async function getMQTTService(): Promise<MQTTService> {
  if (!mqttService) {
    mqttService = new MQTTService();
    await mqttService.connect();
  }
  return mqttService;
}

export { mqttService };
