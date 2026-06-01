import path from 'node:path';
import fs from 'node:fs';
import sharp from 'sharp';
import { logger } from '../../utils/logger.js';
import { SYSTEM_PROMPT, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT } from './prompts.js';
import { callNvidiaApi } from './nvidiaClient.js';
import { parseAIResponse, drawBoundingBoxes } from './nvidiaProcessor.js';
import { DEFAULT_TIMEOUT } from './types.js';
import type { AnalysisContext, NvidianalysisResult, BboxAnalysisResult, PersonDetectionResult, BoundingBox } from './types.js';

export type { AnalysisContext, BoundingBox, PersonDetectionResult, BboxAnalysisResult, NvidianalysisResult, NvidiaApiError } from './types.js';

async function prepareBase64Image(imageInput: string | Buffer): Promise<string> {
  if (Buffer.isBuffer(imageInput)) {
    const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
    return resized.toString('base64');
  } else if (imageInput.startsWith('data:')) {
    const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
    return resized.toString('base64');
  } else if (imageInput.length > 1000) {
    const buffer = Buffer.from(imageInput, 'base64');
    const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
    return resized.toString('base64');
  } else {
    const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
    return resized.toString('base64');
  }
}

export async function analyzeImage(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {}
): Promise<NvidianalysisResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting analysis with model: ${model}`, 'NVIDIA');
  logger.info(`Context: ${JSON.stringify(context)}`, 'NVIDIA');

  try {
    const base64Image = await prepareBase64Image(imageInput);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const apiResponse = await callNvidiaApi(base64Image, context, model, SYSTEM_PROMPT);

      clearTimeout(timeoutId);

      const processingTime = Date.now() - startTime;

      const message = apiResponse.choices?.[0]?.message;
      let content = message?.content || message?.reasoning_content || message?.reasoning || '';

      if (!content) {
        throw new Error('Empty response from NVIDIA API');
      }

      logger.info(`Analysis completed in ${processingTime}ms, content length=${content.length}`, 'NVIDIA');

      return parseAIResponse(content, processingTime, model);

    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      if (fetchError.name === 'AbortError') {
        throw new Error(`NVIDIA API request timed out after ${timeout}ms`);
      }
      throw fetchError;
    }

  } catch (error: any) {
    logger.error('Analysis error: ' + error.message, 'NVIDIA');

    const processingTime = Date.now() - startTime;

    return {
      sceneDescription: `Analysis failed: ${error.message}`,
      threatAssessment: {
        level: 'medium',
        factors: ['API error - unable to complete analysis'],
        confidence: 0
      },
      detectedEntities: {
        people: [],
        vehicles: [],
        animals: [],
        objects: [],
        actions: []
      },
      recommendedActions: ['Check NVIDIA API configuration', 'Verify API key is valid'],
      additionalObservations: [`Error: ${error.message}`],
      processingTime,
      modelUsed: model
    };
  }
}

export async function checkApiHealth(): Promise<{
  available: boolean;
  model: string;
  error?: string;
}> {
  const apiKey = process.env.NVIDIA_API_KEY;
  const model = process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';

  if (!apiKey) {
    return {
      available: false,
      model,
      error: 'NVIDIA_API_KEY not configured'
    };
  }

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    if (response.ok) {
      return { available: true, model };
    } else {
      return {
        available: false,
        model,
        error: `API returned status ${response.status}`
      };
    }
  } catch (error: any) {
    return {
      available: false,
      model,
      error: error.message
    };
  }
}

export async function analyzeWithBoundingBoxes(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {}
): Promise<BboxAnalysisResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting bbox analysis with model: ${model}`, 'NVIDIA');

  try {
    let imagePath: string;
    let base64Image: string;

    if (Buffer.isBuffer(imageInput)) {
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(tempPath);
      imagePath = tempPath;
      base64Image = imageInput.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(Buffer.from(base64Data, 'base64')).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(tempPath);
      imagePath = tempPath;
      base64Image = base64Data;
    } else if (imageInput.length > 1000) {
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(Buffer.from(imageInput, 'base64')).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(tempPath);
      imagePath = tempPath;
      base64Image = imageInput;
    } else {
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      imagePath = imageInput;
      base64Image = resized.toString('base64');
    }

    const contextInfo = [
      context.cameraName ? `Camera: ${context.cameraName}` : null,
      context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    ].filter(Boolean).join(' | ');

    const userMessage = contextInfo
      ? `Context: ${contextInfo}\n\nIdentify all objects in this image carefully. Use percentage coordinates (0-100) for position. Be specific about object types, colors, and positions. Report confidence based on image clarity and visibility.`
      : 'Identify all objects in this image carefully. Use percentage coordinates (0-100) for position. Be specific about object types, colors, and positions. Report confidence based on image clarity.';

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: BBOX_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 4096,
      stream: false,
      top_p: 0.9
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY not configured');
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const apiResponse = await response.json();
    const message = apiResponse.choices?.[0]?.message;
    const content = message?.content || message?.reasoning_content || message?.reasoning || '';
    const processingTime = Date.now() - startTime;

    let detectedBoxes: BoundingBox[] = [];
    let rawAnalysis = {
      people: [] as string[],
      vehicles: [] as string[],
      objects: [] as string[],
      animals: [] as string[]
    };
    let sceneDescription = '';

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const parsed = JSON.parse(jsonStr.trim());

      if (parsed.detected_objects && Array.isArray(parsed.detected_objects)) {
        detectedBoxes = parsed.detected_objects.map((obj: any) => ({
          x: obj.position?.x || 0,
          y: obj.position?.y || 0,
          width: obj.position?.width || 0,
          height: obj.position?.height || 0,
          label: obj.label || obj.description || 'unknown',
          confidence: obj.confidence || 50
        }));
      }

      rawAnalysis.people = parsed.people || [];
      rawAnalysis.vehicles = parsed.vehicles || [];
      rawAnalysis.objects = parsed.objects || [];
      rawAnalysis.animals = parsed.animals || [];
      sceneDescription = parsed.scene_description || '';
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
      } catch (e) { /* ignore */ }
    }

    return {
      boxes: detectedBoxes,
      sceneDescription,
      annotatedImage,
      rawAnalysis,
      processingTime,
      modelUsed: model
    };

  } catch (error: any) {
    logger.error('Bbox analysis error: ' + error.message, 'NVIDIA');
    const processingTime = Date.now() - startTime;

    return {
      boxes: [],
      sceneDescription: `Analysis failed: ${error.message}`,
      annotatedImage: '',
      rawAnalysis: { people: [], vehicles: [], objects: [], animals: [] },
      processingTime,
      modelUsed: model
    };
  }
}

export async function analyzePersons(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {}
): Promise<PersonDetectionResult> {
  const startTime = Date.now();

  const model = options.model || process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  logger.info(`Starting person detection with model: ${model}`, 'NVIDIA');

  try {
    const base64Image = await prepareBase64Image(imageInput);

    const contextInfo = [
      context.cameraName ? `Camera: ${context.cameraName}` : null,
      context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
      context.eventType ? `Event Type: ${context.eventType}` : null,
    ].filter(Boolean).join(' | ');

    const userMessage = contextInfo
      ? `Context: ${contextInfo}\n\nFocus ONLY on detecting humans/people. Provide accurate positions using percentage coordinates (0-100). Be specific about clothing colors, actions, and facing direction. Note any uncertainty due to lighting or distance.`
      : 'Focus ONLY on detecting humans/people. Provide accurate positions using percentage coordinates (0-100). Be specific about clothing colors, actions, and facing direction. If lighting is poor or person is distant, note your uncertainty and reduce confidence.';

    const requestBody = {
      model: model,
      messages: [
        {
          role: 'system',
          content: PERSON_SYSTEM_PROMPT
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` }
            }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 2048,
      stream: false,
      top_p: 0.9
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) {
      throw new Error('NVIDIA_API_KEY not configured');
    }

    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`NVIDIA API error: ${response.status}`);
    }

    const apiResponse = await response.json();
    const personMessage = apiResponse.choices?.[0]?.message;
    const content = personMessage?.content || personMessage?.reasoning_content || personMessage?.reasoning || '';
    const processingTime = Date.now() - startTime;

    let people: PersonDetectionResult['people'] = [];
    let count = 0;
    let sceneDescription = '';

    try {
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);

      const parsed = JSON.parse(jsonStr.trim());

      count = parsed.count || 0;
      sceneDescription = parsed.scene_description || '';

      if (parsed.people && Array.isArray(parsed.people)) {
        people = parsed.people.map((p: any) => ({
          position: {
            x: p.position?.x || 0,
            y: p.position?.y || 0,
            width: p.position?.width || 0,
            height: p.position?.height || 0,
            label: 'person',
            confidence: 80
          },
          description: p.description || '',
          clothing: p.clothing || '',
          actions: p.actions || []
        }));
      }
    } catch (parseError) {
      logger.error('Failed to parse person response', 'NVIDIA', parseError);
      sceneDescription = content.substring(0, 500);
    }

    return {
      count,
      people,
      sceneDescription,
      processingTime,
      modelUsed: model
    };

  } catch (error: any) {
    logger.error('Person detection error: ' + error.message, 'NVIDIA');
    const processingTime = Date.now() - startTime;

    return {
      count: 0,
      people: [],
      sceneDescription: `Analysis failed: ${error.message}`,
      processingTime,
      modelUsed: model
    };
  }
}
