import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { logger } from '../../utils/logger.js';
import { callNvidiaApi } from './nvidiaClient.js';
import { parseAIResponse, normalizeModelBoxes } from './nvidiaProcessor.js';
import { DEFAULT_TIMEOUT } from './types.js';
import type { AnalysisContext } from './types.js';

const MAX_IMAGE_WIDTH = 1280;

export interface AnalysisConfig<T> {
  name: string;
  systemPrompt: string;
  parseResponse: (content: string, processingTime: number, model: string) => T;
}

export interface ImageLoaderResult {
  base64Image: string;
  tempPath?: string;
}

export class ImageLoader {
  async loadAsBase64(imageInput: string | Buffer): Promise<ImageLoaderResult> {
    let buffer: Buffer;

    if (Buffer.isBuffer(imageInput)) {
      buffer = imageInput;
    } else if (imageInput.startsWith('data:')) {
      buffer = Buffer.from(imageInput.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } else if (imageInput.length > 1000) {
      buffer = Buffer.from(imageInput, 'base64');
    } else {
      buffer = fs.readFileSync(imageInput);
    }

    const resized = await sharp(buffer)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    return { base64Image: resized.toString('base64') };
  }

  async loadForBboxAnalysis(imageInput: string | Buffer): Promise<ImageLoaderResult> {
    let buffer: Buffer;

    if (Buffer.isBuffer(imageInput)) {
      buffer = imageInput;
    } else if (imageInput.startsWith('data:')) {
      buffer = Buffer.from(imageInput.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    } else if (imageInput.length > 1000) {
      buffer = Buffer.from(imageInput, 'base64');
    } else {
      buffer = fs.readFileSync(imageInput);
    }

    const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
    await sharp(buffer)
      .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(tempPath);

    const base64Image = (await sharp(tempPath).toBuffer()).toString('base64');
    return { base64Image, tempPath };
  }

  cleanupTempFile(tempPath: string): void {
    if (tempPath.startsWith('/tmp/nvidia_bbox')) {
      try {
        fs.unlinkSync(tempPath);
      } catch {}
    }
  }
}

export const imageLoader = new ImageLoader();

export class AnalysisPipeline {
  private imageLoader: ImageLoader;

  constructor(imageLoader?: ImageLoader) {
    this.imageLoader = imageLoader || new ImageLoader();
  }

  async analyze<T>(
    imageInput: string | Buffer,
    context: AnalysisContext,
    config: AnalysisConfig<T>,
    options: { model?: string; timeout?: number } = {},
  ): Promise<T> {
    const startTime = Date.now();
    const model = options.model || process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.info(`Starting ${config.name} with model: ${model}`, 'NVIDIA');

    try {
      const { base64Image } = await this.imageLoader.loadAsBase64(imageInput);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const apiResponse = await callNvidiaApi(
          base64Image,
          context,
          model,
          config.systemPrompt,
          controller.signal,
        );

        clearTimeout(timeoutId);

        const processingTime = Date.now() - startTime;
        const message = apiResponse.choices?.[0]?.message;
        const content = message?.content || message?.reasoning_content || message?.reasoning || '';

        if (!content) {
          throw new Error('Empty response from NVIDIA API');
        }

        logger.info(
          `${config.name} completed in ${processingTime}ms, content length=${content.length}`,
          'NVIDIA',
        );

        return config.parseResponse(content, processingTime, model);
      } catch (fetchError: unknown) {
        clearTimeout(timeoutId);

        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          throw new Error(`NVIDIA API request timed out after ${timeout}ms`);
        }
        throw fetchError;
      }
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`${config.name} error: ${errMsg}`, 'NVIDIA');
      throw error;
    }
  }

  async analyzeWithBbox(
    imageInput: string | Buffer,
    context: AnalysisContext,
    systemPrompt: string,
    options: { model?: string; timeout?: number } = {},
  ): Promise<{
    boxes: any[];
    sceneDescription: string;
    sceneContext: any;
    annotatedImage: string;
    rawAnalysis: any;
    processingTime: number;
    modelUsed: string;
  }> {
    const startTime = Date.now();
    const model = options.model || process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';
    const timeout = options.timeout || DEFAULT_TIMEOUT;

    logger.info(`Starting bbox analysis with model: ${model}`, 'NVIDIA');

    const { base64Image, tempPath } = await this.imageLoader.loadForBboxAnalysis(imageInput);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const apiResponse = await callNvidiaApi(base64Image, context, model, systemPrompt, controller.signal);

      clearTimeout(timeoutId);

      const message = apiResponse.choices?.[0]?.message;
      const content = message?.content || message?.reasoning_content || message?.reasoning || '';
      const processingTime = Date.now() - startTime;

      let detectedBoxes: any[] = [];
      let rawAnalysis = {
        people: [] as string[],
        vehicles: [] as string[],
        objects: [] as string[],
        animals: [] as string[],
      };
      let sceneDescription = '';
      let sceneContext: any = undefined;

      try {
        let jsonStr = content.trim();
        if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
        else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
        if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

        const parsed = JSON.parse(jsonStr.trim());

        if (parsed.detected_objects && Array.isArray(parsed.detected_objects)) {
          const imgMeta = await sharp(tempPath).metadata().catch(() => null);
          const imgWidth = imgMeta?.width || 0;
          const imgHeight = imgMeta?.height || 0;
          const normalized = normalizeModelBoxes(
            parsed.detected_objects.map((obj: any) => obj?.position),
            imgWidth,
            imgHeight,
          );
          detectedBoxes = parsed.detected_objects
            .map((obj: any, i: number) => {
              const box = normalized[i];
              if (!box) return null;
              return {
                ...box,
                label: obj.label || obj.description || 'unknown',
                confidence: typeof obj.confidence === 'number' ? obj.confidence : 50,
              };
            })
            .filter((b: any): b is any => b !== null);
        }

        rawAnalysis.people = parsed.people || [];
        rawAnalysis.vehicles = parsed.vehicles || [];
        rawAnalysis.objects = parsed.objects || [];
        rawAnalysis.animals = parsed.animals || [];
        sceneDescription = parsed.scene_description || '';
        sceneContext = parsed.scene_context;
      } catch (parseError) {
        logger.error('Failed to parse bbox response', 'NVIDIA', parseError);
        sceneDescription = content.substring(0, 500);
      }

      let annotatedImage = base64Image;
      if (detectedBoxes.length > 0 && tempPath) {
        try {
          const { drawBoundingBoxes } = await import('./nvidiaProcessor.js');
          annotatedImage = await drawBoundingBoxes(tempPath, detectedBoxes);
        } catch (drawError) {
          logger.error('Failed to draw bounding boxes', 'NVIDIA', drawError);
        }
      }

      this.imageLoader.cleanupTempFile(tempPath!);

      return {
        boxes: detectedBoxes,
        sceneDescription,
        sceneContext,
        annotatedImage,
        rawAnalysis,
        processingTime,
        modelUsed: model,
      };
    } catch (error: unknown) {
      if (tempPath) {
        this.imageLoader.cleanupTempFile(tempPath);
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      const errMsg = isAbort
        ? `NVIDIA API request timed out after ${timeout}ms`
        : error instanceof Error
          ? error.message
          : String(error);
      logger.error('Bbox analysis error: ' + errMsg, 'NVIDIA');
      const processingTime = Date.now() - startTime;

      return {
        boxes: [],
        sceneDescription: `Analysis failed: ${errMsg}`,
        sceneContext: undefined,
        annotatedImage: '',
        rawAnalysis: { people: [], vehicles: [], objects: [], animals: [] },
        processingTime,
        modelUsed: model,
      };
    }
  }
}

export const analysisPipeline = new AnalysisPipeline();
