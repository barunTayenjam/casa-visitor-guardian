import { Router, Request, Response } from 'express';
import { analyzeImage, checkApiHealth, analyzeWithBoundingBoxes, analyzePersons } from '../services/nvidiaAnalysisService.js';
import { authenticate } from '../middleware/auth.js';
import fs from 'node:fs';
import path from 'node:path';

const router = Router();

// Apply authentication to all routes in this router
// Remove this line if you want the endpoint to be publicly accessible
// router.use(authenticate());

/**
 * POST /api/nvidia/analyze
 * Analyze an image from a security camera using NVIDIA's vision LLM
 * 
 * Request body:
 * - image: base64 encoded image or file path (string)
 * - cameraId: optional camera identifier (string)
 * - cameraName: optional camera name (string)
 * - triggerReason: optional reason for analysis (string)
 * - eventType: optional event type (string)
 * - detectedObjects: optional array of detected objects (string[])
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    const {
      image,
      imagePath,
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      detectedObjects,
      confidence,
      timestamp
    } = req.body;

    // Validate that we have an image to analyze
    if (!image && !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Either "image" (base64) or "imagePath" (file path) is required'
      });
    }

    // Prepare the image input
    let imageInput: string;
    if (image) {
      imageInput = image;
    } else if (imagePath) {
      // Resolve relative paths
      imageInput = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.join(process.cwd(), imagePath);
      
      // Check if file exists
      if (!fs.existsSync(imageInput)) {
        return res.status(400).json({
          success: false,
          error: `Image file not found: ${imagePath}`
        });
      }
    }

    // Build context object
    const context = {
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      detectedObjects,
      confidence,
      timestamp: timestamp || new Date().toISOString()
    };

    console.log(`[NVIDIA Routes] Analyzing image for camera: ${cameraName || cameraId || 'unknown'}`);
    console.log(`[NVIDIA Routes] Trigger: ${triggerReason || eventType || 'manual analysis'}`);

    // Call the analysis service
    const result = await analyzeImage(imageInput!, context);

    const totalTime = Date.now() - startTime;

    // Save analysis result to database
    const eventIdentifier = imagePath?.split('/').pop()?.replace('.jpg', '') || `analysis_${Date.now()}`;
    const { AppDataSource } = await import('../database.js');
    try {
      const entities = result.detectedEntities || {};
      await AppDataSource.query(
        `INSERT INTO ai_analysis_results 
         (event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, 
          detected_people, detected_vehicles, detected_objects, bounding_boxes, recommended_actions, 
          additional_observations, model_used, processing_time_ms, analyzed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
         ON CONFLICT (event_id) DO UPDATE SET 
          scene_description = EXCLUDED.scene_description,
          threat_level = EXCLUDED.threat_level,
          detected_people = EXCLUDED.detected_people,
          analyzed_at = NOW()`,
        [
          eventIdentifier,
          imagePath?.split('/').pop() || null,
          cameraName || cameraId || null,
          result.sceneDescription || null,
          result.threatAssessment?.level || 'low',
          result.threatAssessment?.confidence || 0,
          JSON.stringify(entities.people || []),
          JSON.stringify(entities.vehicles || []),
          JSON.stringify(entities.objects || []),
          '[]',
          JSON.stringify(result.recommendedActions || []),
          result.additionalObservations || null,
          result.modelUsed,
          totalTime
        ]
      );
      console.log(`[NVIDIA Routes] Analysis saved for event: ${eventIdentifier}`);
    } catch (saveError) {
      console.error('[NVIDIA Routes] Failed to save analysis:', saveError);
    }
    
    res.json({
      success: true,
      analysis: result,
      metadata: {
        processingTime: totalTime,
        timestamp: new Date().toISOString(),
        cameraId,
        cameraName
      }
    });

  } catch (error: any) {
    console.error('[NVIDIA Routes] Analyze error:', error);
    res.status(500).json({
      success: false,
      error: `Analysis failed: ${error.message}`
    });
  }
});

/**
 * POST /api/nvidia/analyze-event
 * Analyze a specific event from the database
 * 
 * Request body:
 * - eventId: the ID of the event to analyze
 * - useStoredImage: whether to use the stored event image (boolean, default: true)
 */
router.post('/analyze-event', async (req: Request, res: Response) => {
  try {
    const { eventId, useStoredImage = true } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'eventId is required'
      });
    }

    // Get event from database
    const { AppDataSource } = await import('../database.js');
    const { Event } = await import('../models/index.js');

    const eventRepository = AppDataSource.getRepository(Event);
    const event = await eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Try to find the image file
    let imagePath: string | null = null;
    
    if (event.file_path) {
      // Try various possible locations
      const possiblePaths = [
        event.file_path,
        path.join(process.cwd(), 'data', 'detections', event.file_path),
        path.join(process.cwd(), 'public', 'events', event.file_path),
        path.join(process.cwd(), 'public', event.file_path),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          imagePath = p;
          break;
        }
      }
    }

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Event image file not found'
      });
    }

    // Build context from event data
    const context = {
      cameraId: event.camera_id,
      cameraName: event.camera_id === 'cam1' ? 'Front Door' : event.camera_id === 'cam2' ? 'Back Door' : undefined,
      triggerReason: 'event analysis',
      eventType: event.event_type,
      detectedObjects: event.object_detections as string[] || [],
      confidence: event.confidence,
      timestamp: event.timestamp.toString()
    };

    console.log(`[NVIDIA Routes] Analyzing event ${eventId} (${event.event_type})`);

    let result;
    try {
      // Try NVIDIA first
      result = await analyzeImage(imagePath, context);
    } catch (nvidiaError: any) {
      console.log('[NVIDIA Routes] NVIDIA failed, falling back to OpenCV:', nvidiaError.message);
      // Fallback to OpenCV detection
      const axios = await import('axios');
      const { getOpenCVServiceUrl } = await import('../config/index.js');
      
      try {
        const imageBuffer = fs.readFileSync(imagePath);
        const opencvResponse = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
          headers: { 'Content-Type': 'image/jpeg' },
          timeout: 30000
        });
        
        const detections = opencvResponse.data.detections || [];
        const persons = detections.filter((d: any) => d.class === 'person');
        
        result = {
          summary: `Detected ${detections.length} objects including ${persons.length} person(s)`,
          persons: persons,
          vehicles: detections.filter((d: any) => ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.class)),
          activities: detections.map((d: any) => d.class),
          overall_summary: `Found ${detections.length} objects in the scene. ${persons.length} person(s) detected.`,
          processing_time_ms: 0,
          model: 'opencv-fallback'
        };
      } catch (opencvError: any) {
        console.error('[NVIDIA Routes] OpenCV fallback also failed:', opencvError.message);
        return res.status(500).json({
          success: false,
          error: `Analysis failed: ${nvidiaError.message}. OpenCV fallback also failed.`
        });
      }
    }

    res.json({
      success: true,
      analysis: result,
      event: {
        id: event.id,
        eventType: event.event_type,
        cameraId: event.camera_id,
        timestamp: event.timestamp
      }
    });

  } catch (error: any) {
    console.error('[NVIDIA Routes] Analyze event error:', error);
    res.status(500).json({
      success: false,
      error: `Event analysis failed: ${error.message}`
    });
  }
});

/**
 * GET /api/nvidia/health
 * Check if NVIDIA API is configured and available
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const health = await checkApiHealth();

    res.json({
      success: true,
      available: health.available,
      model: health.model,
      error: health.error || null
    });
  } catch (error: any) {
    console.error('[NVIDIA Routes] Health check error:', error);
    res.status(500).json({
      success: false,
      error: `Health check failed: ${error.message}`
    });
  }
});

/**
 * GET /api/nvidia/results
 * Get all stored analysis results from database
 */
router.get('/results', async (req: Request, res: Response) => {
  try {
    const { AppDataSource } = await import('../database.js');
    
    const results = await AppDataSource.query(`
      SELECT 
        id, event_id, event_filename, camera_id,
        scene_description, threat_level, threat_confidence,
        detected_people, detected_vehicles, detected_objects,
        bounding_boxes, recommended_actions, additional_observations,
        model_used, processing_time_ms, analyzed_at
      FROM ai_analysis_results
      ORDER BY analyzed_at DESC
      LIMIT 100
    `);

    // Safe JSON parse helper
    const safeJson = (val: any) => {
      if (!val) return [];
      try { return typeof val === 'object' ? val : JSON.parse(val); }
      catch { return []; }
    };

    res.json({
      success: true,
      count: results.length,
      results: results.map((r: any) => ({
        id: r.id,
        eventId: r.event_id,
        eventFilename: r.event_filename,
        cameraId: r.camera_id,
        sceneDescription: r.scene_description || '',
        threatLevel: r.threat_level || 'low',
        detectedPeople: safeJson(r.detected_people),
        detectedVehicles: safeJson(r.detected_vehicles),
        detectedObjects: safeJson(r.detected_objects),
        boundingBoxes: safeJson(r.bounding_boxes),
        recommendedActions: safeJson(r.recommended_actions),
        additionalObservations: r.additional_observations,
        modelUsed: r.model_used,
        processingTimeMs: r.processing_time_ms,
        analyzedAt: r.analyzed_at
      }))
    });
  } catch (error: any) {
    console.error('[NVIDIA Routes] Get results error:', error);
    res.status(500).json({
      success: false,
      error: `Failed to get results: ${error.message}`
    });
  }
});

/**
 * GET /api/nvidia/models
 * List available models (or get configured model info)
 */
router.get('/models', async (req: Request, res: Response) => {
  const configuredModel = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nomo-omni-30b-a3b-reasoning';
  const apiKey = process.env.NVIDIA_API_KEY ? 'configured' : 'not set';

  // Common vision models available via NVIDIA API
  const availableModels = [
    {
      id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
      name: 'Nemotron 3 Nano Omni',
      description: 'Multimodal model with vision and reasoning capabilities',
      recommended: true
    },
    {
      id: 'nvidia/nemotron-4-mini-holodeck',
      name: 'Nemotron 4 Mini Holodeck',
      description: 'Latest multimodal model with enhanced vision understanding'
    },
    {
      id: 'meta/llama-3.2-90b-vision-instruct',
      name: 'Llama 3.2 90B Vision',
      description: 'Meta\'s large vision model for instruction following'
    },
    {
      id: 'google/gemma-2-27b-it',
      name: 'Gemma 2 27B',
      description: 'Google\'s instruction-tuned vision model'
    }
  ];

  res.json({
    success: true,
    configured: {
      model: configuredModel,
      apiKeyStatus: apiKey
    },
    available: availableModels
  });
});

/**
 * PUT /api/nvidia/config
 * Update the model configuration (requires admin/auth)
 */
router.put('/config', authenticate(), async (req: Request, res: Response) => {
  try {
    const { model } = req.body;

    if (!model) {
      return res.status(400).json({
        success: false,
        error: 'model is required'
      });
    }

    // Note: This only updates for the current session
    // For persistent config, you'd want to store in database or env
    process.env.NVIDIA_MODEL = model;

    res.json({
      success: true,
      message: `Model updated to: ${model}`,
      note: 'This change is temporary for the current session'
    });
  } catch (error: any) {
    console.error('[NVIDIA Routes] Config update error:', error);
    res.status(500).json({
      success: false,
      error: `Config update failed: ${error.message}`
    });
  }
});

/**
 * POST /api/nvidia/analyze-with-bboxes
 * Analyze image with bounding box detection
 * Returns both the annotated image (with drawn boxes) and raw analysis
 * 
 * Request body:
 * - image: base64 encoded image (string)
 * - imagePath: path to image file (string)
 * - cameraId: optional camera identifier (string)
 * - cameraName: optional camera name (string)
 * - triggerReason: optional reason for analysis (string)
 */
router.post('/analyze-with-bboxes', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    const {
      image,
      imagePath,
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      detectedObjects,
      confidence,
      timestamp
    } = req.body;

    if (!image && !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Either "image" (base64) or "imagePath" (file path) is required'
      });
    }

    // Prepare the image input
    let imageInput: string;
    if (image) {
      imageInput = image;
    } else if (imagePath) {
      imageInput = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.join(process.cwd(), imagePath);
      
      if (!fs.existsSync(imageInput)) {
        return res.status(400).json({
          success: false,
          error: `Image file not found: ${imagePath}`
        });
      }
    }

    const context = {
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      detectedObjects,
      confidence,
      timestamp: timestamp || new Date().toISOString()
    };

    console.log(`[NVIDIA Routes] Analyzing with bounding boxes for camera: ${cameraName || cameraId || 'unknown'}`);

    const result = await analyzeWithBoundingBoxes(imageInput!, context);

    const totalTime = Date.now() - startTime;
    
    res.json({
      success: true,
      boxes: result.boxes,
      sceneDescription: result.sceneDescription,
      annotatedImage: result.annotatedImage ? `data:image/jpeg;base64,${result.annotatedImage}` : null,
      rawAnalysis: result.rawAnalysis,
      metadata: {
        processingTime: totalTime,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString(),
        cameraId,
        cameraName
      }
    });

  } catch (error: any) {
    console.error('[NVIDIA Routes] Bbox analysis error:', error);
    res.status(500).json({
      success: false,
      error: `Bounding box analysis failed: ${error.message}`
    });
  }
});

/**
 * POST /api/nvidia/analyze-persons
 * Optimized person detection - focuses specifically on detecting people
 * 
 * Request body:
 * - image: base64 encoded image (string)
 * - imagePath: path to image file (string)
 * - cameraId: optional camera identifier (string)
 * - cameraName: optional camera name (string)
 * - triggerReason: optional reason for analysis (string)
 * - eventType: optional event type (string)
 * - onlyOnMotion: optional - only trigger if motion detected (boolean)
 */
router.post('/analyze-persons', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    
    const {
      image,
      imagePath,
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      onlyOnMotion,
      timestamp,
      eventId
    } = req.body;

    if (!image && !imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Either "image" (base64) or "imagePath" (file path) is required'
      });
    }

    // Determine event identifier for caching
    const eventIdentifier = eventId || imagePath?.split('/').pop()?.replace('.jpg', '') || `analysis_${Date.now()}`;
    
    // Check if we already have an analysis for this event
    const { AppDataSource } = await import('../database.js');
    
    try {
      const cachedResult = await AppDataSource.query(
        `SELECT * FROM ai_analysis_results WHERE event_id = $1 LIMIT 1`,
        [eventIdentifier]
      );
      
      if (cachedResult && cachedResult.length > 0) {
        console.log(`[NVIDIA Routes] Returning cached analysis for event: ${eventIdentifier}`);
        return res.json({
          success: true,
          count: cachedResult[0].detected_people ? JSON.parse(cachedResult[0].detected_people).length : 0,
          people: cachedResult[0].detected_people ? JSON.parse(cachedResult[0].detected_people) : [],
          sceneDescription: cachedResult[0].scene_description,
          threatAssessment: { level: cachedResult[0].threat_level },
          metadata: {
            processingTime: cachedResult[0].processing_time_ms,
            modelUsed: cachedResult[0].model_used,
            timestamp: cachedResult[0].analyzed_at,
            cameraId: cachedResult[0].camera_id,
            cameraName: cachedResult[0].camera_id,
            cached: true
          }
        });
      }
    } catch (cacheError) {
      console.log('[NVIDIA Routes] Cache check failed, proceeding with analysis:', cacheError);
    }

    // Prepare the image input
    let imageInput: string;
    if (image) {
      imageInput = image;
    } else if (imagePath) {
      imageInput = path.isAbsolute(imagePath) 
        ? imagePath 
        : path.join(process.cwd(), imagePath);
      
      if (!fs.existsSync(imageInput)) {
        return res.status(400).json({
          success: false,
          error: `Image file not found: ${imagePath}`
        });
      }
    }

    const context = {
      cameraId,
      cameraName,
      triggerReason,
      eventType,
      timestamp: timestamp || new Date().toISOString()
    };

    console.log(`[NVIDIA Routes] Detecting persons for camera: ${cameraName || cameraId || 'unknown'}`);

    const result = await analyzePersons(imageInput!, context);

    const totalTime = Date.now() - startTime;
    
    // Save the result to database for future lookups
    try {
      await AppDataSource.query(
        `INSERT INTO ai_analysis_results 
         (event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, 
          detected_people, detected_vehicles, detected_objects, bounding_boxes, recommended_actions, 
          model_used, processing_time_ms, analyzed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
         ON CONFLICT (event_id) DO UPDATE SET 
          scene_description = EXCLUDED.scene_description,
          threat_level = EXCLUDED.threat_level,
          detected_people = EXCLUDED.detected_people,
          bounding_boxes = EXCLUDED.bounding_boxes,
          analyzed_at = NOW()`,
        [
          eventIdentifier,
          imagePath?.split('/').pop() || null,
          cameraId || cameraName || null,
          result.sceneDescription || null,
          'low',
          result.people?.length > 0 ? 70 : 30,
          JSON.stringify(result.people || []),
          '[]',
          '[]',
          JSON.stringify(result.people?.map((p: any) => p.position) || []),
          JSON.stringify(['Review if person detected']),
          result.modelUsed,
          totalTime
        ]
      );
      console.log(`[NVIDIA Routes] Analysis saved for event: ${eventIdentifier}`);
    } catch (saveError) {
      console.error('[NVIDIA Routes] Failed to save analysis:', saveError);
    }
    
    res.json({
      success: true,
      count: result.count,
      people: result.people,
      sceneDescription: result.sceneDescription,
      metadata: {
        processingTime: totalTime,
        modelUsed: result.modelUsed,
        timestamp: new Date().toISOString(),
        cameraId,
        cameraName,
        triggeredOnMotion: onlyOnMotion || false
      }
    });

  } catch (error: any) {
    console.error('[NVIDIA Routes] Person detection error:', error);
    res.status(500).json({
      success: false,
      error: `Person detection failed: ${error.message}`
    });
  }
});

/**
 * POST /api/nvidia/analyze-event-with-bboxes
 * Analyze a specific event from the database with bounding boxes
 * 
 * Request body:
 * - eventId: the ID of the event to analyze (string)
 * - includeAnnotatedImage: whether to include the annotated image (boolean, default: true)
 */
router.post('/analyze-event-with-bboxes', async (req: Request, res: Response) => {
  try {
    const { eventId, includeAnnotatedImage = true } = req.body;

    if (!eventId) {
      return res.status(400).json({
        success: false,
        error: 'eventId is required'
      });
    }

    // Get event from database
    const { AppDataSource } = await import('../database.js');
    const { Event } = await import('../models/index.js');

    const eventRepository = AppDataSource.getRepository(Event);
    const event = await eventRepository.findOne({ where: { id: eventId } });

    if (!event) {
      return res.status(404).json({
        success: false,
        error: 'Event not found'
      });
    }

    // Find the image file
    let imagePath: string | null = null;
    
    if (event.file_path) {
      const possiblePaths = [
        event.file_path,
        path.join(process.cwd(), 'data', 'detections', event.file_path),
        path.join(process.cwd(), 'public', 'events', event.file_path),
        path.join(process.cwd(), 'public', event.file_path),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          imagePath = p;
          break;
        }
      }
    }

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'Event image file not found'
      });
    }

    const context = {
      cameraId: event.camera_id,
      cameraName: event.camera_id === 'cam1' ? 'Front Door' : event.camera_id === 'cam2' ? 'Back Door' : undefined,
      triggerReason: 'event bbox analysis',
      eventType: event.event_type,
      detectedObjects: event.object_detections as string[] || [],
      confidence: event.confidence,
      timestamp: event.timestamp.toString()
    };

    console.log(`[NVIDIA Routes] Analyzing event ${eventId} with bounding boxes`);

    const result = await analyzeWithBoundingBoxes(imagePath, context);

    res.json({
      success: true,
      boxes: result.boxes,
      sceneDescription: result.sceneDescription,
      annotatedImage: includeAnnotatedImage && result.annotatedImage 
        ? `data:image/jpeg;base64,${result.annotatedImage}` 
        : null,
      rawAnalysis: result.rawAnalysis,
      event: {
        id: event.id,
        eventType: event.event_type,
        cameraId: event.camera_id,
        timestamp: event.timestamp
      },
      metadata: {
        processingTime: result.processingTime,
        modelUsed: result.modelUsed
      }
    });

  } catch (error: any) {
    console.error('[NVIDIA Routes] Event bbox analysis error:', error);
    res.status(500).json({
      success: false,
      error: `Event bounding box analysis failed: ${error.message}`
    });
  }
});

export default router;