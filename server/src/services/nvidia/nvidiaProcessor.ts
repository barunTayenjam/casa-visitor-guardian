import sharp from 'sharp';
import { logger } from '../../utils/logger.js';
import { normalizeEntityArray } from './nvidiaClient.js';
import type { NvidianalysisResult, BoundingBox } from './types.js';

function buildResult(parsed: any, processingTime: number, model: string): NvidianalysisResult {
  let p = parsed;
  const topDesc = p.scene_description || p.sceneDescription || '';
  if (typeof topDesc === 'string' && topDesc.trim().startsWith('{')) {
    try {
      const inner = JSON.parse(topDesc);
      if (inner && typeof inner === 'object') {
        p = inner;
      }
    } catch {}
  }

  return {
    sceneDescription: p.scene_description || p.sceneDescription || 'No description available',
    threatAssessment: {
      level: p.threat_assessment?.level || p.threatAssessment?.level || 'low',
      factors: p.threat_assessment?.reasoning ? [p.threat_assessment.reasoning] : (p.threat_assessment?.factors || p.threatAssessment?.factors || []),
      confidence: p.threat_assessment?.confidence || p.threatAssessment?.confidence || 50
    },
    detectedEntities: {
      people: normalizeEntityArray(p.detected_entities?.people || p.detectedEntities?.people, 'person'),
      vehicles: normalizeEntityArray(p.detected_entities?.vehicles || p.detectedEntities?.vehicles, 'vehicle'),
      animals: normalizeEntityArray(p.detected_entities?.animals || p.detectedEntities?.animals, 'animal'),
      objects: normalizeEntityArray(p.detected_entities?.objects || p.detectedEntities?.objects, 'object'),
      actions: []
    },
    recommendedActions: p.recommended_actions || p.recommendedActions || [],
    additionalObservations: p.additional_observations || p.additionalObservations || [],
    processingTime,
    modelUsed: model
  };
}

export function parseAIResponse(
  responseContent: string,
  processingTime: number,
  model: string
): NvidianalysisResult {
  const tryParse = (str: string): any | null => {
    try { return JSON.parse(str); } catch { return null; }
  };

  try {
    let jsonStr = responseContent.trim();

    if (jsonStr.startsWith('{')) {
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonEnd > 0) {
        const parsed = tryParse(jsonStr.substring(0, jsonEnd + 1));
        if (parsed) return buildResult(parsed, processingTime, model);
      }
    }

    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const extracted = codeBlockMatch[1].trim();
      let parsed = tryParse(extracted);
      if (parsed) return buildResult(parsed, processingTime, model);
      const clean = extracted.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
      if (clean.trim().startsWith('{')) {
        parsed = tryParse(clean);
        if (parsed) return buildResult(parsed, processingTime, model);
      }
    }

    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart >= 0) {
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonEnd > jsonStart) {
        const extracted = jsonStr.substring(jsonStart, jsonEnd + 1);
        let parsed = tryParse(extracted);
        if (parsed) return buildResult(parsed, processingTime, model);
      }
    }

    const cleaned = jsonStr
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/#/g, '')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    const s = cleaned.indexOf('{');
    const e = cleaned.lastIndexOf('}');
    if (s >= 0 && e > s) {
      const parsed = tryParse(cleaned.substring(s, e + 1));
      if (parsed) return buildResult(parsed, processingTime, model);
    }

    if (jsonStr.length > 10) {
      return {
        sceneDescription: jsonStr.replace(/^["'\s]+|["'\s]+$/g, '').substring(0, 500),
        threatAssessment: { level: 'low', factors: [], confidence: 30 },
        detectedEntities: { people: [], vehicles: [], animals: [], objects: [], actions: [] },
        recommendedActions: [],
        additionalObservations: ['Raw text used as description (JSON parsing failed)'],
        processingTime,
        modelUsed: model
      };
    }

    throw new Error('Failed to parse JSON from response');
  } catch (parseError: any) {
    logger.error('All JSON parse strategies failed: ' + parseError.message, 'NVIDIA');

    if (responseContent.trim().length > 10) {
      return {
        sceneDescription: responseContent.trim().substring(0, 500),
        threatAssessment: { level: 'low', factors: [], confidence: 30 },
        detectedEntities: { people: [], vehicles: [], animals: [], objects: [], actions: [] },
        recommendedActions: [],
        additionalObservations: ['Raw text used as description (JSON parsing failed)'],
        processingTime,
        modelUsed: model
      };
    }

    return {
      sceneDescription: 'No description available',
      threatAssessment: { level: 'low', factors: [], confidence: 30 },
      detectedEntities: { people: [], vehicles: [], animals: [], objects: [], actions: [] },
      recommendedActions: [],
      additionalObservations: ['Response parsing encountered issues'],
      processingTime,
      modelUsed: model
    };
  }
}

export { buildResult };

export async function drawBoundingBoxes(
  imagePath: string,
  boxes: BoundingBox[]
): Promise<string> {
  try {
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    const boxElements = boxes.map(box => {
      const x = (box.x / 100) * width;
      const y = (box.y / 100) * height;
      const w = (box.width / 100) * width;
      const h = (box.height / 100) * height;

      let strokeColor = '#FF0000';
      if (box.label.toLowerCase().includes('person')) {
        strokeColor = '#00FF00';
      } else if (box.label.toLowerCase().includes('vehicle') ||
                 box.label.toLowerCase().includes('car')) {
        strokeColor = '#00FFFF';
      } else if (box.label.toLowerCase().includes('animal') ||
                 box.label.toLowerCase().includes('dog') ||
                 box.label.toLowerCase().includes('cat')) {
        strokeColor = '#FF00FF';
      }

      return `
        <rect 
          x="${x}" y="${y}" 
          width="${w}" height="${h}" 
          fill="none" 
          stroke="${strokeColor}" 
          stroke-width="3"
          rx="5"
        />
        <rect 
          x="${x}" y="${Math.max(0, y - 25)}" 
          width="${Math.min(w, 150)}" height="25" 
          fill="${strokeColor}"
        />
        <text 
          x="${x + 5}" y="${Math.max(0, y - 7)}" 
          fill="white" 
          font-family="Arial" 
          font-size="14"
          font-weight="bold"
        >${box.label} (${Math.round(box.confidence)}%)</text>
      `;
    }).join('');

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${boxElements}
      </svg>
    `;

    const annotatedBuffer = await sharp(imagePath)
      .composite([{
        input: Buffer.from(svg),
        top: 0,
        left: 0
      }])
      .jpeg({ quality: 90 })
      .toBuffer();

    return annotatedBuffer.toString('base64');
  } catch (error: any) {
    logger.error('Error drawing bounding boxes', 'NVIDIA', error);
    const originalBuffer = await sharp(imagePath).jpeg().toBuffer();
    return originalBuffer.toString('base64');
  }
}
