import { SYSTEM_PROMPT, BBOX_SYSTEM_PROMPT, PERSON_SYSTEM_PROMPT } from './prompts.js';
import { parseAIResponse, normalizeModelBoxes } from './nvidiaProcessor.js';
import { getNvidiaBaseUrl } from './nvidiaClient.js';
import { DEFAULT_TIMEOUT } from './types.js';
import { analysisPipeline, imageLoader } from './analysisPipeline.js';
import type {
  AnalysisContext,
  NvidianalysisResult,
  BboxAnalysisResult,
  PersonDetectionResult,
} from './types.js';

export type {
  AnalysisContext,
  NvidianalysisResult,
  BboxAnalysisResult,
  PersonDetectionResult,
} from './types.js';

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
    const response = await fetch(`${getNvidiaBaseUrl()}/models`, {
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

export async function analyzeImage(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<NvidianalysisResult> {
  return analysisPipeline.analyze(
    imageInput,
    context,
    {
      name: 'analysis',
      systemPrompt: SYSTEM_PROMPT,
      parseResponse: parseAIResponse,
    },
    options,
  );
}

export async function analyzeWithBoundingBoxes(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<BboxAnalysisResult> {
  return analysisPipeline.analyzeWithBbox(imageInput, context, BBOX_SYSTEM_PROMPT, options);
}

export async function analyzePersons(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {},
): Promise<PersonDetectionResult> {
  return analysisPipeline.analyze(
    imageInput,
    context,
    {
      name: 'person detection',
      systemPrompt: PERSON_SYSTEM_PROMPT,
      parseResponse: (content, processingTime, model) => {
        let people: PersonDetectionResult['people'] = [];
        let count = 0;
        let sceneDescription: string;
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
            const normalized = normalizeModelBoxes(
              parsed.people.map((p: any) => p?.position),
              0,
              0,
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
              .filter((p: any): p is any => p !== null);
          }
        } catch (parseError) {
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
      },
    },
    options,
  );
}
