import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Interface for analysis context
export interface AnalysisContext {
  cameraId?: string;
  cameraName?: string;
  triggerReason?: string;
  timestamp?: string;
  eventType?: string;
  detectedObjects?: string[];
  confidence?: number;
}

// Interface for bounding box coordinates (percentages)
export interface BoundingBox {
  x: number;        // Percentage (0-100) from left
  y: number;       // Percentage (0-100) from top
  width: number;   // Percentage (0-100) of image width
  height: number;  // Percentage (0-100) of image height
  label: string;   // Object/person label
  confidence: number;  // Confidence score (0-100)
}

// Interface for person detection result
export interface PersonDetectionResult {
  count: number;
  people: {
    position: BoundingBox;
    description: string;
    clothing?: string;
    actions?: string[];
  }[];
  sceneDescription: string;
  processingTime: number;
  modelUsed: string;
}

// Interface for bounding box analysis result
export interface BboxAnalysisResult {
  boxes: BoundingBox[];
  sceneDescription: string;
  annotatedImage: string;  // base64 encoded image with drawn boxes
  rawAnalysis: {
    people: string[];
    vehicles: string[];
    objects: string[];
    animals: string[];
  };
  processingTime: number;
  modelUsed: string;
}

// Interface for the analysis result
export interface NvidianalysisResult {
  sceneDescription: string;
  threatAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    factors: string[];
    confidence: number;
  };
  detectedEntities: {
    people: string[];
    vehicles: string[];
    animals: string[];
    objects: string[];
    actions: string[];
  };
  recommendedActions: string[];
  additionalObservations: string[];
  processingTime: number;
  modelUsed: string;
}

// Interface for API error
export interface NvidiaApiError {
  error: string;
  message: string;
  code?: string;
}

// Vision analysis system prompt - strict, accurate, structured
const SYSTEM_PROMPT = `You are a precise visual analysis AI. Your goal is accurate, detailed scene understanding with conservative confidence scoring.

## CRITICAL OUTPUT REQUIREMENT
You MUST respond with ONLY valid JSON. No markdown, no code blocks, no headers, no bold text, no lists, no explanations, no preamble, no postamble. Your entire response must be a single valid JSON object.

## JSON SCHEMA (exact format required)
{"scene_description":"string","threat_assessment":{"level":"low|medium|high|critical","confidence":0-100,"reasoning":"string"},"detected_entities":{"people":[],"vehicles":[],"animals":[],"objects":[]},"recommended_actions":[],"additional_observations":[]}

## ACCURACY RULES
1. Only report what you can clearly see — if uncertain, set confidence below 60
2. Never guess or hallucinate
3. Conservative confidence scoring — reduce if poor lighting, distance, or partial visibility
4. Be specific: "white SUV parked left side" not "vehicle"
5. Count accurately — if 2 people, report count:2
6. Position: left/right/center, foreground/midground/background
7. Describe behavior precisely: "walking toward camera" not "walking"
8. Note lighting and visibility conditions in additional_observations

## RESPONSE FORMAT
- Your ENTIRE response must be ONLY valid JSON starting with {
- Do NOT use markdown code blocks (triple backticks)
- Do NOT use bold text
- Do NOT use headers
- Do NOT use list markers
- Do NOT include any text outside the JSON object
- If you cannot clearly identify something, use empty arrays and low confidence`;

// System prompt for bounding box detection - strict and accurate
const BBOX_SYSTEM_PROMPT = `You are a precise object detection AI for security camera analysis.

## TASK
Analyze this image and produce ONLY valid JSON describing all detectable objects with their positions.

## JSON SCHEMA (exact format)
{
  "detected_objects": [
    {
      "label": "person|car|suv|truck|van|motorcycle|bicycle|dog|cat|bird|package|bag|unknown",
      "description": "Precise description: color, size relative to scene, distinguishing features",
      "position": {
        "x": 0-100,
        "y": 0-100,
        "width": 0-100,
        "height": 0-100
      },
      "confidence": 0-100
    }
  ],
  "scene_description": "Brief but specific description of the scene",
  "people": ["specific description per person including clothing colors if visible"],
  "vehicles": ["type, color, location in scene per vehicle"],
  "objects": ["package, bag, or other notable objects with location"],
  "animals": ["type, color, behavior if visible per animal"]
}

## ACCURACY RULES
1. Use percentage coordinates (0-100) for position
2. x: percentage from left edge, y: percentage from top edge
3. width/height: size relative to full image
4. Confidence 0-100: only report high confidence (80+) for distant or blurry objects
5. Be specific about object types: "white sedan" not "vehicle"
6. Position should be approximate bounding box for the object
7. Only include objects you can clearly identify
8. Note if lighting, distance, or angle affects accuracy

## FORMAT RULES
- JSON ONLY — no markdown, no explanation text
- If nothing detected, use empty arrays []
- All text in English`;

// System prompt for person detection - strict and accurate
const PERSON_SYSTEM_PROMPT = `You are a precise human detection AI for security camera analysis.

## TASK
Analyze this image and produce ONLY valid JSON focusing on human detection.

## JSON SCHEMA (exact format)
{
  "count": number of people detected,
  "people": [
    {
      "position": {
        "x": 0-100,
        "y": 0-100,
        "width": 0-100,
        "height": 0-100
      },
      "description": "Estimated age range, build (slim/average/athletic/heavy), height relative to scene, visible features",
      "clothing": "Top: color and style | Bottom: color | Footwear if visible",
      "actions": ["specific action: walking-toward-camera, standing-idle, running, sitting, bending, reaching, carrying-object"],
      "facing": "front|back|side|unknown",
      "confidence": 0-100
    }
  ],
  "scene_description": "Brief description of the overall scene context",
  "potential_threats": ["specific concern if any: loitering, suspicious behavior, unauthorized access attempt, etc. or empty if normal"]
}

## ACCURACY RULES
1. Focus ONLY on humans — ignore other objects
2. Position as percentage of full image (0-100)
3. Provide accurate count — if 1 person, count=1 not "a few"
4. Clothing: be specific about colors ("navy blue shirt", not just "dark shirt")
5. Actions: be precise ("walking toward camera at moderate pace" not "walking")
6. If low light or poor visibility, reduce confidence to 40-70 and note uncertainty
7. Do not count reflections, shadows, or people in mirrors as separate individuals
8. If no people, return count:0 with empty people array

## FORMAT RULES
- JSON ONLY — no markdown, no explanation text
- All text in English`;

// Default timeout for API calls (90 seconds)
const DEFAULT_TIMEOUT = 90000;

/**
 * Normalize entity arrays — handles both old format (strings) and new format (objects)
 */
function normalizeEntityArray(input: unknown, type: string): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input.map(item => {
      if (typeof item === 'string') return item;
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        // Build description from object fields
        const parts: string[] = [];
        if (obj.description) parts.push(String(obj.description));
        if (obj.count !== undefined) parts.push(`count:${obj.count}`);
        if (obj.type) parts.push(String(obj.type));
        if (obj.color) parts.push(String(obj.color));
        if (obj.location) parts.push(String(obj.location));
        if (obj.state || obj.behavior) parts.push(String(obj.state || obj.behavior));
        if (obj.clothing) parts.push(String(obj.clothing));
        if (obj.significance) parts.push(String(obj.significance));
        return parts.length > 0 ? parts.join(' | ') : type;
      }
      return String(item);
    });
  }
  return [];
}

/**
 * Convert image file to base64 encoding
 */
function imageToBase64(imagePath: string): string {
  const absolutePath = path.isAbsolute(imagePath) 
    ? imagePath 
    : path.join(process.cwd(), imagePath);
  
  const imageBuffer = fs.readFileSync(absolutePath);
  return imageBuffer.toString('base64');
}

/**
 * Call NVIDIA API with image for analysis
 */
async function callNvidiaApi(
  base64Image: string,
  context: AnalysisContext,
  model: string
): Promise<any> {
  const apiKey = process.env.NVIDIA_API_KEY;
  
  if (!apiKey) {
    throw new Error('NVIDIA_API_KEY environment variable is not set');
  }

  const contextInfo = [
    context.cameraName ? `Camera: ${context.cameraName}` : null,
    context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    context.eventType ? `Event Type: ${context.eventType}` : null,
    context.detectedObjects?.length ? `Detected Objects: ${context.detectedObjects.join(', ')}` : null,
    context.timestamp ? `Timestamp: ${context.timestamp}` : null,
  ].filter(Boolean).join(' | ');

  const userMessage = contextInfo
    ? `Context: ${contextInfo}\n\nAnalyze this image carefully. Your response MUST be ONLY valid JSON starting with { and ending with }. No markdown, no code blocks, no preamble. Be specific about counts, colors, positions, and behaviors.`
    : 'Analyze this image carefully. Your response MUST be ONLY valid JSON starting with { and ending with }. No markdown, no code blocks, no preamble. Be specific about counts, colors, positions, and behaviors.';

  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: userMessage
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/jpeg;base64,${base64Image}`
            }
          }
        ]
      }
    ],
    temperature: 0.1,
    max_tokens: 2048,
    stream: false,
    top_p: 0.9
  };

  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`NVIDIA API error: ${response.status} - ${errorData.message || response.statusText}`);
      }

      return await response.json();
    } catch (err: any) {
      lastError = err;
      if (attempt < 3) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + Math.random() * 500, 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error('NVIDIA API call failed after 3 retries');
}

/**
 * Parse the AI response into structured result
 */
function parseAIResponse(
  responseContent: string,
  processingTime: number,
  model: string
): NvidianalysisResult {
  const tryParse = (str: string): any | null => {
    try { return JSON.parse(str); } catch { return null; }
  };

  try {
    let jsonStr = responseContent.trim();

    // Strategy 1: Direct JSON (starts with {)
    if (jsonStr.startsWith('{')) {
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonEnd > 0) {
        const parsed = tryParse(jsonStr.substring(0, jsonEnd + 1));
        if (parsed) return buildResult(parsed, processingTime, model);
      }
    }

    // Strategy 2: Markdown code block extraction
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

    // Strategy 3: Find JSON object anywhere in text
    const jsonStart = jsonStr.indexOf('{');
    if (jsonStart >= 0) {
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonEnd > jsonStart) {
        const extracted = jsonStr.substring(jsonStart, jsonEnd + 1);
        let parsed = tryParse(extracted);
        if (parsed) return buildResult(parsed, processingTime, model);
      }
    }

    // Strategy 4: Try removing markdown formatting and re-extract
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

    // Strategy 5: Last resort — try wrapping the whole content as a description
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
    console.error('[NVIDIA Parse] All strategies failed:', parseError.message);

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

function buildResult(parsed: any, processingTime: number, model: string): NvidianalysisResult {
  // Handle double-encoded JSON: some models return
  // {"scene_description": "{\"scene_description\": ...}"}  — unwrap it
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

/**
 * Main function to analyze an image using NVIDIA's vision LLM
 */
export async function analyzeImage(
  imageInput: string | Buffer,
  context: AnalysisContext = {},
  options: {
    model?: string;
    timeout?: number;
  } = {}
): Promise<NvidianalysisResult> {
  const startTime = Date.now();
  
  // Default model - can be overridden via options
  const model = options.model || process.env.NVIDIA_MODEL || 'meta/llama-3.2-90b-vision-instruct';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  console.log(`[NVIDIA Analysis] Starting analysis with model: ${model}`);
  console.log(`[NVIDIA Analysis] Context:`, JSON.stringify(context));

  try {
    // Handle and resize image - can be base64 string, file path, or Buffer
    let base64Image: string;
    
    if (Buffer.isBuffer(imageInput)) {
      // Resize to 800px max for better accuracy
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.length > 1000) {
      // Likely already a base64 string - resize it
      const buffer = Buffer.from(imageInput, 'base64');
      const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else {
      // File path - read and resize (maintain aspect ratio)
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    }

    // Set up timeout handling
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const apiResponse = await callNvidiaApi(base64Image, context, model);
      
      clearTimeout(timeoutId);

      const processingTime = Date.now() - startTime;
      
      // Extract content from the response
      const content = apiResponse.choices?.[0]?.message?.content || '';
      
      if (!content) {
        throw new Error('Empty response from NVIDIA API');
      }

      console.log(`[NVIDIA Analysis] completed in ${processingTime}ms, content length=${content.length}`);
      console.log(`[NVIDIA Content] start: "${content.substring(0, 80).replace(/\n/g, '\\n')}"`);
      console.log(`[NVIDIA Content] end:   "${content.substring(content.length - 80).replace(/\n/g, '\\n')}"`);

      return parseAIResponse(content, processingTime, model);
      
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        throw new Error(`NVIDIA API request timed out after ${timeout}ms`);
      }
      throw fetchError;
    }

  } catch (error: any) {
    console.error('[NVIDIA Analysis] Error:', error.message);
    
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

/**
 * Check if NVIDIA API is configured and available
 */
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
    // Quick test with a minimal request to check API connectivity
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

/**
 * Draw bounding boxes on an image using sharp
 * @param imagePath Path to the image file
 * @param boxes Array of bounding boxes to draw
 * @returns Base64 encoded annotated image
 */
async function drawBoundingBoxes(
  imagePath: string,
  boxes: BoundingBox[]
): Promise<string> {
  try {
    // Get image metadata
    const metadata = await sharp(imagePath).metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // Create SVG with rectangles for each bounding box
    const boxElements = boxes.map(box => {
      const x = (box.x / 100) * width;
      const y = (box.y / 100) * height;
      const w = (box.width / 100) * width;
      const h = (box.height / 100) * height;
      
      // Color based on label
      let strokeColor = '#FF0000'; // red for unknown
      if (box.label.toLowerCase().includes('person')) {
        strokeColor = '#00FF00'; // green for people
      } else if (box.label.toLowerCase().includes('vehicle') || 
                 box.label.toLowerCase().includes('car')) {
        strokeColor = '#00FFFF'; // cyan for vehicles
      } else if (box.label.toLowerCase().includes('animal') ||
                 box.label.toLowerCase().includes('dog') ||
                 box.label.toLowerCase().includes('cat')) {
        strokeColor = '#FF00FF'; // magenta for animals
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

    // Composite SVG over the original image
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
    console.error('[NVIDIA Service] Error drawing bounding boxes:', error);
    // Return original image if drawing fails
    const originalBuffer = await sharp(imagePath).jpeg().toBuffer();
    return originalBuffer.toString('base64');
  }
}

/**
 * Analyze image with bounding box detection
 * Returns annotated image with boxes and raw analysis data
 */
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

  console.log(`[NVIDIA Bbox Analysis] Starting with model: ${model}`);

  try {
    // Prepare image
    let imagePath: string;
    let base64Image: string;
    
    if (Buffer.isBuffer(imageInput)) {
      // Write to temp file at 800px for accuracy
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
      // Already base64
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(Buffer.from(imageInput, 'base64')).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toFile(tempPath);
      imagePath = tempPath;
      base64Image = imageInput;
    } else {
      // File path - resize at 800px for base64
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      imagePath = imageInput;
      base64Image = resized.toString('base64');
    }

    // Build context message
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
    const content = apiResponse.choices?.[0]?.message?.content || '';
    const processingTime = Date.now() - startTime;

    // Parse the response to extract bounding boxes
    let detectedBoxes: BoundingBox[] = [];
    let rawAnalysis = {
      people: [] as string[],
      vehicles: [] as string[],
      objects: [] as string[],
      animals: [] as string[]
    };
    let sceneDescription = '';

    try {
      // Extract JSON from response
      let jsonStr = content.trim();
      if (jsonStr.startsWith('```json')) jsonStr = jsonStr.slice(7);
      else if (jsonStr.startsWith('```')) jsonStr = jsonStr.slice(3);
      if (jsonStr.endsWith('```')) jsonStr = jsonStr.slice(0, -3);
      
      const parsed = JSON.parse(jsonStr.trim());
      
      // Extract boxes from detected_objects
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

      // Extract other analysis data
      rawAnalysis.people = parsed.people || [];
      rawAnalysis.vehicles = parsed.vehicles || [];
      rawAnalysis.objects = parsed.objects || [];
      rawAnalysis.animals = parsed.animals || [];
      sceneDescription = parsed.scene_description || '';
    } catch (parseError) {
      console.error('[NVIDIA Bbox] Failed to parse response:', parseError);
      sceneDescription = content.substring(0, 500);
    }

    // Draw bounding boxes on image
    let annotatedImage = base64Image;
    if (detectedBoxes.length > 0 && imagePath) {
      try {
        annotatedImage = await drawBoundingBoxes(imagePath, detectedBoxes);
      } catch (drawError) {
        console.error('[NVIDIA Bbox] Failed to draw boxes:', drawError);
      }
    }

    // Clean up temp file if we created one
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
    console.error('[NVIDIA Bbox Analysis] Error:', error.message);
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

/**
 * Optimized person detection
 * Focuses specifically on detecting and analyzing people
 */
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

  console.log(`[NVIDIA Person Detection] Starting with model: ${model}`);

  try {
    // Prepare and resize image for faster LLM processing
    let base64Image: string;
    
if (Buffer.isBuffer(imageInput)) {
      // Resize to 800px max for better accuracy
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.length > 1000) {
      // Already base64 - resize at 800px
      const buffer = Buffer.from(imageInput, 'base64');
      const resized = await sharp(buffer).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    } else {
      // File path - read and resize at 800px
      const resized = await sharp(imageInput).resize(800, 800, { fit: 'inside' }).jpeg({ quality: 85 }).toBuffer();
      base64Image = resized.toString('base64');
    }

    // Context for person detection
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
      max_tokens: 1024,
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
    const content = apiResponse.choices?.[0]?.message?.content || '';
    const processingTime = Date.now() - startTime;

    // Parse person detection response
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
            confidence: 80 // Default confidence for person detection
          },
          description: p.description || '',
          clothing: p.clothing || '',
          actions: p.actions || []
        }));
      }
    } catch (parseError) {
      console.error('[NVIDIA Person] Failed to parse response:', parseError);
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
    console.error('[NVIDIA Person Detection] Error:', error.message);
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

export default {
  analyzeImage,
  checkApiHealth,
  analyzeWithBoundingBoxes,
  analyzePersons
};