import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger.js';
import { CircuitBreaker } from './circuitBreaker.js';
import type { RelationAnalysisResult, RelationInputDetection } from '../types/event.js';

export class RelationsServiceClient {
  private client: AxiosInstance;
  private breaker: CircuitBreaker;

  constructor(serviceUrl?: string) {
    const url = serviceUrl || process.env.RELATIONS_SERVICE_URL || 'http://localhost:8085';

    this.client = axios.create({
      baseURL: url,
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.RELATIONS_API_TOKEN ? { 'X-API-Token': process.env.RELATIONS_API_TOKEN } : {}),
      },
    });

    this.breaker = new CircuitBreaker('RelationsService', {
      failureThreshold: 3,
      cooldownMs: 30000,
      successThreshold: 2,
    });
  }

  async analyzeRelations(
    imagePath: string,
    detections: RelationInputDetection[],
  ): Promise<RelationAnalysisResult> {
    return this.post(imagePath, { image_path: imagePath, detections });
  }

  async analyzeRelationsWithScene(
    imagePath: string,
    trackedDetections: RelationInputDetection[],
  ): Promise<RelationAnalysisResult> {
    return this.post(imagePath, { image_path: imagePath, detections: trackedDetections, scene: true });
  }

  private async post(
    imagePath: string,
    body: Record<string, unknown>,
  ): Promise<RelationAnalysisResult> {
    try {
      logger.info(
        `RelationsService: Analyzing relations in ${imagePath} (${(body.detections as unknown[]).length} detections${body.scene ? ', scene' : ''})`,
        'RelationsClient',
      );

      const response = await this.breaker.execute(() => this.client.post('/analyze-relations', body));
      return response.data as RelationAnalysisResult;
    } catch (error) {
      logger.error(
        `RelationsService: Relation analysis failed for ${imagePath}`,
        'RelationsClient',
        error,
      );

      if (axios.isAxiosError(error)) {
        throw new Error(
          `Relations service error: ${error.response?.data?.error || error.message}`,
          { cause: error },
        );
      }

      throw error;
    }
  }
  /**
   * Get circuit breaker state
   */
  getBreakerState(): string {
    return this.breaker.getState();
  }
}

export const relationsServiceClient = new RelationsServiceClient();
