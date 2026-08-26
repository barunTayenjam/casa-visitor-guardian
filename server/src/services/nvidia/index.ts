import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { logger } from '../../utils/logger.js';
import { SYSTEM_PROMPT, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT } from './prompts.js';
import { callNvidiaApi } from './nvidiaClient.js';
import { parseAIResponse, drawBoundingBoxes, normalizeModelBoxes } from './nvidiaProcessor.js';
import { DEFAULT_TIMEOUT } from './types.js';
import type {
  AnalysisContext,
  NvidianalysisResult,
  BboxAnalysisResult,
  PersonDetectionResult,
  BoundingBox,
} from './types.js';

export type {
  AnalysisContext,
  BoundingBox,
  PersonDetectionResult,
  BboxAnalysisResult,
  NvidianalysisResult,
  NvidiaApiError,
} from './types.js';

const MAX_IMAGE_WIDTH = 1280;

async function prepareBase64Image(imageInput: string | Buffer): Promise<string> {
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
  return resized.toString('base64');
}

export async function analyzeImage(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<NvidianalysisResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting analysis with model: ${model}`, 'NVIDIA');
  logger.info(`Context: ${JSON.stringify(context)}`, 'NVIDIA');

  try {
    const base64Image = await prepareBase64Image(imageInput);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const apiResponse = await callNvidiaApi(base64Image, context, model, SYSTEM_PROMPT, controller.signal);

      clearTimeout(timeoutId);

      const processingTime = Date.now() - startTime;

      const message = apiResponse.choices?.[0]?.message;
      let content = message?.content || message?.reasoning_content || message?.reasoning || '';

      if (!content) {
        throw new Error('Empty response from NVIDIA API');
      }

      logger.info(
        `Analysis completed in ${processingTime}ms, content length=${content.length}`,
        'NVIDIA',
      );

      return parseAIResponse(content, processingTime, model);
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);

      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error(`NVIDIA API request timed out after ${timeout}ms`);
      }
      throw fetchError;
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Analysis error: ' + errMsg, 'NVIDIA');

    const processingTime = Date.now() - startTime;

    return {
      sceneDescription: `Analysis failed: ${errMsg}`,
      threatAssessment: {
        level: 'medium',
        factors: ['API error - unable to complete analysis'],
        confidence: 0,
      },
      detectedEntities: {
        people: [],
        vehicles: [],
        animals: [],
        objects: [],
        actions: [],
      },
      recommendedActions: ['Check NVIDIA API configuration', 'Verify API key is valid'],
      additionalObservations: [`Error: ${errMsg}`],
      processingTime,
      modelUsed: model,
    };
  }
}

export async function checkApiHealth(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';

  if (!apiKey) {
    return {
      available: false,
      model,
      error: 'NVIDIA_API_KEY not configured',
    };
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      return { available: true, model };
    } else {
      return {
        available: false,
        model,
        error: `API returned status ${response.status}`,
      };
    }
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      available: false,
      model,
      error: errMsg,
    };
  }
}

export async function analyzeWithBoundingBoxes(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<BboxAnalysisResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting bbox analysis with model: ${model}`, 'NVIDIA');

  try {
    let imagePath: string;
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
    imagePath = tempPath;
    const base64Image = (await sharp(tempPath).toBuffer()).toString('base64');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const apiResponse = await callNvidiaApi(base64Image, context, model, BBOX_SYSTEM_PROMPT, controller.signal);

    clearTimeout(timeoutId);

    const message = apiResponse.choices?.[0]?.message;
    const content = message?.content || message?.reasoning_content || message?.reasoning || '';
    const processingTime = Date.now() - startTime;

    let detectedBoxes: BoundingBox[] = [];
    let rawAnalysis = {
      people: [] as string[],
      vehicles: [] as string[],
      objects: [] as string[],
      animals: [] as string[],
    };
    let sceneDescription = '';
    let sceneContext: BboxAnalysisResult['sceneContext'] = undefined;

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const parsed = JSON.parse(jsonStr.trim());

      if (parsed.detected_objects && Array.isArray(parsed.detected_objects)) {
        const imgMeta = await sharp(imagePath).metadata().catch(() => null);
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
          .filter((b: BoundingBox | null): b is BoundingBox => b !== null);
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
    if (detectedBoxes.length > 0 && imagePath) {
      try {
        annotatedImage = await drawBoundingBoxes(imagePath, detectedBoxes);
      } catch (drawError) {
        logger.error('Failed to draw bounding boxes', 'NVIDIA', drawError);
      }
    }

    if (imagePath.startsWith('/tmp/nvidia_bbox')) {
      try {
        fs.unlinkSync(imagePath);
      } catch (e) {
        /* ignore */
      }
    }

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
      annotatedImage: '',
      rawAnalysis: { people: [], vehicles: [], objects: [], animals: [] },
      processingTime,
      modelUsed: model,
    };
  }
}

export async function analyzePersons(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<PersonDetectionResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'gemini/gemini-3.5-flash-lite';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting person detection with model: ${model}`, 'NVIDIA');

  try {
    const base64Image = await prepareBase64Image(imageInput);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const apiResponse = await callNvidiaApi(base64Image, context, model, PERSON_SYSTEM_PROMPT, controller.signal);

    clearTimeout(timeoutId);

    const personMessage = apiResponse.choices?.[0]?.message;
    const content =
      personMessage?.content || personMessage?.reasoning_content || personMessage?.reasoning || '';
    const processingTime = Date.now() - startTime;

    let people: PersonDetectionResult['people'] = [];
    let count = 0;
    let sceneDescription = '';
    let sceneContext: PersonDetectionResult['sceneContext'] = undefined;

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const parsed = JSON.parse(jsonStr.trim());

      count = parsed.count || 0;
      sceneDescription = parsed.scene_description || '';
      sceneContext = parsed.scene_context;

      if (parsed.people && Array.isArray(parsed.people)) {
        const imgMeta = await sharp(Buffer.from(base64Image, 'base64'))
          .metadata()
          .catch(() => null);
        const imgWidth = imgMeta?.width || 0;
        const imgHeight = imgMeta?.height || 0;
        const normalized = normalizeModelBoxes(
          parsed.people.map((p: any) => p?.position),
          imgWidth,
          imgHeight,
        );
        people = parsed.people
          .map((p: any, i: number) => {
            const box = normalized[i];
            if (!box) return null;
            return {
              position: { ...box, label: 'person', confidence: 80 },
              description: p.description || '',
              clothing: p.clothing || '',
              actions: p.actions || [],
            };
          })
          .filter((p: PersonDetectionResult['people'][number] | null): p is PersonDetectionResult['people'][number] => p !== null);
      }
    } catch (parseError) {
      logger.error('Failed to parse person response', 'NVIDIA', parseError);
      sceneDescription = content.substring(0, 500);
    }

    return {
      count,
      people,
      sceneDescription,
      sceneContext,
      processingTime,
      modelUsed: model,
    };
  } catch (error: unknown) {
    const isAbort = error instanceof Error && error.name === 'AbortError';
    const errMsg = isAbort
      ? `NVIDIA API request timed out after ${timeout}ms`
      : error instanceof Error
        ? error.message
        : String(error);
    logger.error('Person detection error: ' + errMsg, 'NVIDIA');
    const processingTime = Date.now() - startTime;

    return {
      count: 0,
      people: [],
      sceneDescription: `Analysis failed: ${errMsg}`,
      sceneContext: undefined,
      processingTime,
      modelUsed: model,
    };
  }
}
