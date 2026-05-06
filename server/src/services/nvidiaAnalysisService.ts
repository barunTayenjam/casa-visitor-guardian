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

// Home security-focused system prompt - STRICT FORMAT
const SYSTEM_PROMPT = `You are a home security AI. Analyze this camera image and respond ONLY with valid JSON.

CRITICAL: Your response must be ONLY valid JSON - no explanations, no markdown, no additional text before or after.

Response format:
{
  "scene_description": "2-3 sentence description of what you see",
  "threat_assessment": {"level": "low|medium|high|critical", "confidence": 0-100},
  "detected_entities": {
    "people": ["single line description per person"],
    "vehicles": ["single line per vehicle"],
    "animals": ["single line per animal"],
    "objects": ["single line per notable object"]
  },
  "recommended_actions": ["one action per item"],
  "additional_observations": ["one observation per item"]
}

Rules:
- Use ONLY the JSON format shown above
- Do NOT include any text outside the JSON
- Do NOT use markdown code blocks
- Keep descriptions concise and factual
- If nothing detected, use empty arrays []`;

// System prompt for bounding box detection
const BBOX_SYSTEM_PROMPT = `You are a home security expert AI assistant. Analyze the provided image from a home security camera and identify all detectable objects with their positions.

Your response must be in JSON format with the following structure:
{
  "detected_objects": [
    {
      "label": "person|vehicle|animal|object",
      "description": "Brief description of the object",
      "position": {
        "x": 0-100,  // Percentage from left edge
        "y": 0-100,  // Percentage from top edge
        "width": 0-100,  // Percentage of image width
        "height": 0-100  // Percentage of image height
      },
      "confidence": 0-100
    }
  ],
  "scene_description": "Brief description of what you see",
  "people": ["description of each person"],
  "vehicles": ["vehicle descriptions"],
  "objects": ["notable objects"],
  "animals": ["animal descriptions"]
}

Guidelines:
- Use percentage values (0-100) for all coordinates
- x: horizontal position from left edge
- y: vertical position from top edge
- width/height: size relative to full image
- Include confidence scores (0-100)
- Be specific about object types (person, car, truck, dog, package, etc.)
- Note multiple objects of the same type with different positions
- Only include objects you're confident about`;

// System prompt for optimized person detection
const PERSON_SYSTEM_PROMPT = `You are a home security expert AI specializing in human detection. Analyze this security camera frame focusing ONLY on detecting people.

Your response must be in JSON format:
{
  "count": number of people detected,
  "people": [
    {
      "position": {
        "x": 0-100,  // Percentage from left
        "y": 0-100,  // Percentage from top
        "width": 0-100,  // Width percentage
        "height": 0-100  // Height percentage
      },
      "description": "Brief description (age, build, posture)",
      "clothing": "Clothing description (shirt color, pants, etc.)",
      "actions": ["what they're doing"]
    }
  ],
  "scene_description": "Brief description of the scene",
  "potential_threats": ["any concerning observations about the people"]
}

Guidelines:
- Focus ONLY on detecting humans/people
- Provide accurate position percentages
- Note clothing details (colors, types)
- Describe actions/behavior
- Estimate count accurately
- If no people, return count: 0 and empty people array`;

// Default timeout for API calls (90 seconds)
const DEFAULT_TIMEOUT = 90000;

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

  // Build context-aware user message
  const contextInfo = [
    context.cameraName ? `Camera: ${context.cameraName}` : null,
    context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    context.eventType ? `Event Type: ${context.eventType}` : null,
    context.detectedObjects?.length ? `Detected Objects: ${context.detectedObjects.join(', ')}` : null,
    context.timestamp ? `Timestamp: ${context.timestamp}` : null,
  ].filter(Boolean).join(' | ');

  const userMessage = contextInfo 
    ? `Context: ${contextInfo}\n\nPlease analyze this security camera frame and provide your assessment.`
    : 'Please analyze this security camera frame and provide your assessment.';

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
    temperature: 0.3,
    max_tokens: 2048,
    stream: false
  };

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
}

/**
 * Parse the AI response into structured result
 */
function parseAIResponse(
  responseContent: string,
  processingTime: number,
  model: string
): NvidianalysisResult {
  try {
    // Try to extract JSON from the response
    // The response might contain markdown code blocks or malformed JSON
    let jsonStr = responseContent.trim();
    
    // Remove markdown code block syntax if present
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.slice(7);
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.slice(3);
    }
    
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.slice(0, -3);
    }

    // Remove newlines and extra whitespace within the JSON string
    jsonStr = jsonStr.replace(/\s+/g, ' ').trim();
    
    // Try to find and extract valid JSON object
    let parsed = null;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Try to extract JSON by finding first { and last }
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        let extracted = jsonStr.substring(jsonStart, jsonEnd + 1);
        // Clean up any trailing text after the JSON
        extracted = extracted.split('}')[0] + '}';
        try {
          parsed = JSON.parse(extracted);
        } catch {
          // Try removing any non-JSON trailing content
          const cleanMatch = extracted.match(/^\s*\{[\s\S]*\}\s*$/);
          if (cleanMatch) {
            try {
              parsed = JSON.parse(cleanMatch[0]);
            } catch {}
          }
        }
      }
    }
    
    if (!parsed) {
      throw new Error('Failed to parse JSON from response');
    }
    
    return {
      sceneDescription: parsed.scene_description || parsed.sceneDescription || 'No description available',
      threatAssessment: {
        level: parsed.threat_assessment?.level || parsed.threatAssessment?.level || 'low',
        factors: parsed.threat_assessment?.factors || parsed.threatAssessment?.factors || [],
        confidence: parsed.threat_assessment?.confidence || parsed.threatAssessment?.confidence || 50
      },
      detectedEntities: {
        people: parsed.detected_entities?.people || parsed.detectedEntities?.people || [],
        vehicles: parsed.detected_entities?.vehicles || parsed.detectedEntities?.vehicles || [],
        animals: parsed.detected_entities?.animals || parsed.detectedEntities?.animals || [],
        objects: parsed.detected_entities?.objects || parsed.detectedEntities?.objects || [],
        actions: parsed.detected_entities?.actions || parsed.detectedEntities?.actions || []
      },
      recommendedActions: parsed.recommended_actions || parsed.recommendedActions || [],
      additionalObservations: parsed.additional_observations || parsed.additionalObservations || [],
      processingTime,
      modelUsed: model
    };
  } catch (parseError) {
    // If JSON parsing fails, return a fallback response
    console.error('Failed to parse AI response as JSON:', parseError);
    console.error('Raw response:', responseContent);
    
    return {
      sceneDescription: responseContent.substring(0, 500),
      threatAssessment: {
        level: 'low',
        factors: ['Unable to fully parse AI response'],
        confidence: 30
      },
      detectedEntities: {
        people: [],
        vehicles: [],
        animals: [],
        objects: [],
        actions: []
      },
      recommendedActions: ['Review raw response for details'],
      additionalObservations: ['Response parsing encountered issues'],
      processingTime,
      modelUsed: model
    };
  }
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
  const model = options.model || process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  console.log(`[NVIDIA Analysis] Starting analysis with model: ${model}`);
  console.log(`[NVIDIA Analysis] Context:`, JSON.stringify(context));

  try {
    // Handle and resize image - can be base64 string, file path, or Buffer
    let base64Image: string;
    
    if (Buffer.isBuffer(imageInput)) {
      // Resize to max 640px for faster LLM processing
      const resized = await sharp(imageInput).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const resized = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.length > 1000) {
      // Likely already a base64 string - resize it
      const buffer = Buffer.from(imageInput, 'base64');
      const resized = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else {
      // File path - read and resize
      const resized = await sharp(imageInput).jpeg({ quality: 80 }).toBuffer();
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

      console.log(`[NVIDIA Analysis] Analysis completed in ${processingTime}ms`);

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
  const model = process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';

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
  
  const model = options.model || process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  console.log(`[NVIDIA Bbox Analysis] Starting with model: ${model}`);

  try {
    // Prepare image
    let imagePath: string;
    let base64Image: string;
    
    if (Buffer.isBuffer(imageInput)) {
      // Write to temp file for sharp processing
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(imageInput).jpeg().toFile(tempPath);
      imagePath = tempPath;
      base64Image = imageInput.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(Buffer.from(base64Data, 'base64')).jpeg().toFile(tempPath);
      imagePath = tempPath;
      base64Image = base64Data;
    } else if (imageInput.length > 1000) {
      // Already base64
      const tempPath = path.join('/tmp', `nvidia_bbox_${Date.now()}.jpg`);
      await sharp(Buffer.from(imageInput, 'base64')).jpeg().toFile(tempPath);
      imagePath = tempPath;
      base64Image = imageInput;
    } else {
      // File path
      imagePath = imageInput;
      const buffer = fs.readFileSync(imagePath);
      base64Image = buffer.toString('base64');
    }

    // Build context message
    const contextInfo = [
      context.cameraName ? `Camera: ${context.cameraName}` : null,
      context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
    ].filter(Boolean).join(' | ');

    const userMessage = contextInfo 
      ? `Context: ${contextInfo}\n\nIdentify all objects in this security camera frame with their positions. Use percentage coordinates (0-100) for position.`
      : 'Identify all objects in this security camera frame with their positions. Use percentage coordinates (0-100) for position.';

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
      temperature: 0.2,
      max_tokens: 2048,
      stream: false
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
  
  const model = options.model || process.env.NVIDIA_MODEL || 'nvidia/llama-3.1-nemotron-nano-vl-8b-v1';
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  console.log(`[NVIDIA Person Detection] Starting with model: ${model}`);

  try {
    // Prepare and resize image for faster LLM processing
    let base64Image: string;
    
    if (Buffer.isBuffer(imageInput)) {
      // Resize to max 640px width for faster processing
      const resized = await sharp(imageInput).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.startsWith('data:')) {
      const base64Data = imageInput.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const resized = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else if (imageInput.length > 1000) {
      // Already base64 - assume it's already small or resize it
      const buffer = Buffer.from(imageInput, 'base64');
      const resized = await sharp(buffer).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    } else {
      // File path - read and resize
      const resized = await sharp(imageInput).jpeg({ quality: 80 }).toBuffer();
      base64Image = resized.toString('base64');
    }

    // Context for person detection
    const contextInfo = [
      context.cameraName ? `Camera: ${context.cameraName}` : null,
      context.triggerReason ? `Trigger: ${context.triggerReason}` : null,
      context.eventType ? `Event Type: ${context.eventType}` : null,
    ].filter(Boolean).join(' | ');

    const userMessage = contextInfo 
      ? `Context: ${contextInfo}\n\nFocus ONLY on detecting humans/people. Provide accurate positions using percentage coordinates (0-100).`
      : 'Focus ONLY on detecting humans/people. Provide accurate positions using percentage coordinates (0-100).';

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
      temperature: 0.2,
      max_tokens: 1024,  // Smaller since focused on people
      stream: false
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