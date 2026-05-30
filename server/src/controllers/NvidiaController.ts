import { logger } from '../utils/logger.js';
import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { BaseController } from './BaseController.js';
import { analyzeImage, checkApiHealth, analyzeWithBoundingBoxes, analyzePersons } from '../services/nvidiaAnalysisService.js';

export class NvidiaController extends BaseController {
  async analyze(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const { image, imagePath: imgPath, cameraId, cameraName, triggerReason, eventType, detectedObjects, confidence, timestamp } = req.body;

      if (!image && !imgPath) {
        this.badRequest(res, 'Either "image" (base64) or "imagePath" (file path) is required');
        return;
      }

      let imageInput: string;
      if (image) {
        imageInput = image;
      } else if (imgPath) {
        imageInput = path.isAbsolute(imgPath) ? imgPath : path.join(process.cwd(), imgPath);
        if (!fs.existsSync(imageInput)) {
          this.badRequest(res, `Image file not found: ${imgPath}`);
          return;
        }
      }

      const context = { cameraId, cameraName, triggerReason, eventType, detectedObjects, confidence, timestamp: timestamp || new Date().toISOString() };

      const result = await analyzeImage(imageInput!, context);
      const totalTime = Date.now() - startTime;

      const eventIdentifier = imgPath?.split('/').pop()?.replace('.jpg', '') || `analysis_${Date.now()}`;
      const { AppDataSource } = await import('../database.js');
      try {
        const entities = result.detectedEntities || { people: [], vehicles: [], animals: [], objects: [], actions: [] };
        await AppDataSource.query(
          `INSERT INTO ai_analysis_results (event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, detected_people, detected_vehicles, detected_objects, bounding_boxes, recommended_actions, additional_observations, model_used, processing_time_ms, analyzed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT (event_id) DO UPDATE SET scene_description = EXCLUDED.scene_description, threat_level = EXCLUDED.threat_level, detected_people = EXCLUDED.detected_people, analyzed_at = NOW()`,
          [eventIdentifier, imgPath?.split('/').pop() || null, cameraName || cameraId || null, result.sceneDescription || null, result.threatAssessment?.level || 'low', result.threatAssessment?.confidence || 0, JSON.stringify(entities.people || []), JSON.stringify(entities.vehicles || []), JSON.stringify(entities.objects || []), '[]', JSON.stringify(result.recommendedActions || []), result.additionalObservations || null, result.modelUsed, totalTime]
        );
       } catch (saveError) {
        logger.error('[NVIDIA Controller] Failed to save analysis', 'NVIDIA', saveError);
      }

      res.json({
        success: true,
        analysis: result,
        metadata: { processingTime: totalTime, timestamp: new Date().toISOString(), cameraId, cameraName }
      });
    } catch (error: any) {
      this.serverError(res, error, 'nvidia analyze');
    }
  }

  private normalizeSceneDescription(text: string): string {
    if (typeof text !== 'string' || !text) return '';
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parsed.scene_description || parsed.sceneDescription || parsed.description || parsed.summary || parsed.overall_summary || text;
      } catch {
        try {
          const match = trimmed.match(/"scene_description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (match) return match[1];
        } catch {}
      }
    }
    return text;
  }

  private buildOpenCVFallbackResult(detections: any[], startTime: number): any {
    const persons = detections.filter((d: any) => d.class === 'person');
    const vehicles = detections.filter((d: any) => ['car', 'truck', 'bus', 'motorcycle', 'bicycle'].includes(d.class));
    const animals = detections.filter((d: any) => ['dog', 'cat', 'bird', 'horse', 'cow'].includes(d.class));
    const otherObjects = detections.filter((d: any) =>
      !['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'dog', 'cat', 'bird', 'horse', 'cow'].includes(d.class)
    );

    const getDescriptions = (items: any[], label: string): string[] => {
      if (items.length === 0) return [];
      const counts = new Map<string, number>();
      for (const item of items) {
        const c = item.class || label;
        counts.set(c, (counts.get(c) || 0) + 1);
      }
      return Array.from(counts.entries()).map(([cls, count]) =>
        count > 1 ? `${count}× ${cls}` : cls
      );
    };

    const personDescs = persons.map((p: any, i: number) =>
      `Person ${i + 1} detected near center of frame`
    );

    const sceneParts: string[] = [];
    if (persons.length > 0) {
      sceneParts.push(`${persons.length} person(s) detected`);
    }
    if (vehicles.length > 0) {
      const vehicleTypes = getDescriptions(vehicles, 'vehicle');
      sceneParts.push(`${vehicleTypes.join(', ')}`);
    }
    if (animals.length > 0) {
      const animalTypes = getDescriptions(animals, 'animal');
      sceneParts.push(`${animalTypes.join(', ')}`);
    }
    if (otherObjects.length > 0) {
      const objectTypes = getDescriptions(otherObjects, 'object');
      sceneParts.push(`${objectTypes.join(', ')}`);
    }

    const sceneDescription = sceneParts.length > 0
      ? `Scene contains ${sceneParts.join('; ')}. Total ${detections.length} objects detected.`
      : `No significant objects detected in the scene.`;

    const threatLevel = persons.length > 0 ? 'medium' : (vehicles.length > 0 ? 'low' : 'low');
    const threatConfidence = persons.length > 2 ? 75 : persons.length > 0 ? 50 : 10;

    const factors: string[] = [];
    if (persons.length > 0) factors.push(`${persons.length} person(s) present`);
    if (vehicles.length > 0) factors.push('Vehicle activity detected');

    const recommendedActions: string[] = [];
    if (persons.length > 0) recommendedActions.push('Review person detection footage');
    if (vehicles.length > 0) recommendedActions.push('Check vehicle activity');
    if (persons.length > 2) recommendedActions.push('Multiple persons detected — verify if expected');
    if (animals.length > 0) recommendedActions.push('Animal activity in frame');

    return {
      sceneDescription,
      summary: sceneDescription,
      persons: personDescs,
      vehicles: getDescriptions(vehicles, 'vehicle'),
      activities: getDescriptions(vehicles, 'vehicle'),
      overall_summary: sceneDescription,
      threatAssessment: { level: threatLevel, factors, confidence: threatConfidence },
      detectedEntities: {
        people: personDescs,
        vehicles: getDescriptions(vehicles, 'vehicle'),
        animals: getDescriptions(animals, 'animal'),
        objects: getDescriptions(otherObjects, 'object'),
        actions: []
      },
      recommendedActions,
      additionalObservations: [
        `Analysis via OpenCV object detection (${detections.length} objects)`,
        persons.length > 0 ? `${persons.length} person(s) in frame` : 'No persons detected'
      ],
      processing_time_ms: Date.now() - startTime,
      model: 'opencv-fallback'
    };
  }

  async analyzeEvent(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, useStoredImage = true } = req.body;
      if (!eventId) { this.badRequest(res, 'eventId is required'); return; }

      const { AppDataSource } = await import('../database.js');
      const { Event } = await import('../models/index.js');
      const eventRepository = AppDataSource.getRepository(Event);
      const event = await eventRepository.findOne({ where: { id: eventId } });
      if (!event) { this.notFound(res, 'Event not found'); return; }

      // Check cache: return persisted analysis if available
      try {
        const cachedResult = await AppDataSource.query(
          `SELECT * FROM ai_analysis_results WHERE event_id = $1 LIMIT 1`, [eventId]
        );
        if (cachedResult && cachedResult.length > 0) {
          const c = cachedResult[0];
          const safeJson = (val: any) => {
            if (!val) return [];
            try { return typeof val === 'object' ? val : JSON.parse(val); } catch { return []; }
          };
          const cachedSceneDesc = this.normalizeSceneDescription(c.scene_description || '');
          res.json({
            success: true,
            analysis: {
              sceneDescription: cachedSceneDesc,
              summary: cachedSceneDesc,
              persons: safeJson(c.detected_people),
              vehicles: safeJson(c.detected_vehicles),
              activities: [],
              overall_summary: cachedSceneDesc,
              threatAssessment: { level: c.threat_level || 'low', factors: [], confidence: c.threat_confidence || 0 },
              detectedEntities: { people: safeJson(c.detected_people), vehicles: safeJson(c.detected_vehicles), animals: safeJson(c.detected_animals), objects: safeJson(c.detected_objects), actions: [] },
              recommendedActions: safeJson(c.recommended_actions),
              additionalObservations: c.additional_observations || [],
              processing_time_ms: c.processing_time_ms || 0,
              model: c.model_used || 'cached',
              cached: true
            },
            event: { id: event.id, eventType: event.event_type, cameraId: event.camera_id, timestamp: event.timestamp }
          });
          return;
        }
      } catch (cacheError) {
        // proceed without cache
      }

      let imagePath: string | null = null;
      const filename = event.file_path ? path.basename(event.file_path) : '';
      if (event.file_path) {
        const storedPath = event.file_path;
        const possiblePaths: string[] = [];

        if (path.isAbsolute(storedPath)) {
          if (storedPath.startsWith('/app/data/')) {
            possiblePaths.push(storedPath.replace('/app/', path.join(process.cwd(), '..') + '/'));
            possiblePaths.push(storedPath.replace('/app/', process.cwd() + '/'));
          }
          possiblePaths.push(storedPath);
        }
        possiblePaths.push(path.join(process.cwd(), storedPath), path.join(process.cwd(), '..', storedPath));
        possiblePaths.push(path.join(process.cwd(), 'public', 'events', filename), path.join(process.cwd(), 'public', filename));

        const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const yearMonth = `${dateMatch[1]}-${dateMatch[2]}`;
          const eventTypeDir = storedPath.includes('/faces/') ? 'faces' : 'motion';
          possiblePaths.push(
            path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', eventTypeDir, filename),
            path.join(process.cwd(), '..', 'data', 'detections', yearMonth, 'events', eventTypeDir, filename),
            `/app/data/detections/${yearMonth}/events/${eventTypeDir}/${filename}`,
          );
        }

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) { imagePath = p; break; }
        }
      }

      if (!imagePath) { this.badRequest(res, 'Event image file not found'); return; }

      const context = {
        cameraId: event.camera_id,
        cameraName: event.camera_id === 'cam1' ? 'Front Door' : event.camera_id === 'cam2' ? 'Back Door' : undefined,
        triggerReason: 'event analysis',
        eventType: event.event_type,
        detectedObjects: event.object_detections.map(d => d.class),
        confidence: event.confidence,
        timestamp: event.timestamp.toString()
      };

      let result: any;
      let isNvidiaResult = false;
      const startTime = Date.now();
      try {
        result = await analyzeImage(imagePath, context);
        isNvidiaResult = true;
        if (result.sceneDescription?.startsWith('Analysis failed:')) {
          throw new Error(result.sceneDescription.replace('Analysis failed: ', ''));
        }
      } catch (nvidiaError: any) {
        const axios = (await import('axios')).default;
        const { getOpenCVServiceUrl } = await import('../config/index.js');
        try {
          const imageBuffer = fs.readFileSync(imagePath);
          const opencvResponse = await axios.post(`${getOpenCVServiceUrl()}/detect-objects`, imageBuffer, {
            headers: { 'Content-Type': 'image/jpeg' }, timeout: 30000
          });
          const detections: any[] = opencvResponse.data.detections || [];
          result = this.buildOpenCVFallbackResult(detections, startTime);
        } catch (opencvError: any) {
          this.serverError(res, `Analysis failed: ${nvidiaError.message}. OpenCV fallback also failed.`);
          return;
        }
      }

      if (isNvidiaResult && result) {
        const rawDesc = result.sceneDescription || result.overall_summary || result.summary || '';
        const normalizedDesc = this.normalizeSceneDescription(rawDesc);
        result = {
          sceneDescription: normalizedDesc,
          summary: normalizedDesc,
          persons: result.detectedEntities?.people || result.persons || [],
          vehicles: result.detectedEntities?.vehicles || result.vehicles || [],
          activities: result.detectedEntities?.actions || result.activities || [],
          overall_summary: normalizedDesc,
          threatAssessment: result.threatAssessment || { level: 'low', factors: [], confidence: 0 },
          detectedEntities: result.detectedEntities || { people: [], vehicles: [], animals: [], objects: [], actions: [] },
          recommendedActions: result.recommendedActions || [],
          additionalObservations: result.additionalObservations || [],
          processing_time_ms: result.processingTime || 0,
          model: result.modelUsed || 'nvidia'
        };
      }

      // Persist analysis result to database
      try {
        const entities = result.detectedEntities || {};
        const threatLevel = result.threatAssessment?.level || 'low';
        const threatConfidence = result.threatAssessment?.confidence || 0;
        await AppDataSource.query(
          `INSERT INTO ai_analysis_results (event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, detected_people, detected_vehicles, detected_objects, detected_animals, recommended_actions, additional_observations, model_used, processing_time_ms, analyzed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())
           ON CONFLICT (event_id) DO UPDATE SET scene_description = EXCLUDED.scene_description, threat_level = EXCLUDED.threat_level, detected_people = EXCLUDED.detected_people, detected_vehicles = EXCLUDED.detected_vehicles, detected_objects = EXCLUDED.detected_objects, detected_animals = EXCLUDED.detected_animals, recommended_actions = EXCLUDED.recommended_actions, model_used = EXCLUDED.model_used, processing_time_ms = EXCLUDED.processing_time_ms, analyzed_at = NOW()`,
          [eventId, filename, event.camera_id, result.overall_summary || result.sceneDescription || '', threatLevel, threatConfidence,
           JSON.stringify(entities.people || result.persons || []), JSON.stringify(entities.vehicles || result.vehicles || []),
           JSON.stringify(entities.objects || []), JSON.stringify(entities.animals || []),
           JSON.stringify(result.recommendedActions || []), result.additionalObservations || null,
           result.model || result.modelUsed || 'unknown', result.processing_time_ms || result.processingTime || (Date.now() - startTime)]
        );
      } catch (saveError) {
        logger.error('[NVIDIA Controller] Failed to persist analysis', 'NVIDIA', saveError);
      }

      res.json({
        success: true, analysis: result,
        event: { id: event.id, eventType: event.event_type, cameraId: event.camera_id, timestamp: event.timestamp }
      });
    } catch (error: any) {
      this.serverError(res, error, 'analyzeEvent');
    }
  }

  async health(req: Request, res: Response): Promise<void> {
    try {
      const healthResult = await checkApiHealth();
      res.json({ success: true, available: healthResult.available, model: healthResult.model, error: healthResult.error || null });
    } catch (error: any) {
      this.serverError(res, error, 'nvidia health');
    }
  }

  async getResults(req: Request, res: Response): Promise<void> {
    try {
      const { AppDataSource } = await import('../database.js');
      const results = await AppDataSource.query(
        `SELECT id, event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, detected_people, detected_vehicles, detected_objects, bounding_boxes, recommended_actions, additional_observations, model_used, processing_time_ms, analyzed_at FROM ai_analysis_results ORDER BY analyzed_at DESC LIMIT 100`
      );

      const safeJson = (val: any) => {
        if (!val) return [];
        try { return typeof val === 'object' ? val : JSON.parse(val); } catch { return []; }
      };

      res.json({
        success: true, count: results.length,
        results: results.map((r: any) => ({
          id: r.id, eventId: r.event_id, eventFilename: r.event_filename, cameraId: r.camera_id,
          sceneDescription: r.scene_description || '', threatLevel: r.threat_level || 'low',
          detectedPeople: safeJson(r.detected_people), detectedVehicles: safeJson(r.detected_vehicles),
          detectedObjects: safeJson(r.detected_objects), boundingBoxes: safeJson(r.bounding_boxes),
          recommendedActions: safeJson(r.recommended_actions), additionalObservations: r.additional_observations,
          modelUsed: r.model_used, processingTimeMs: r.processing_time_ms, analyzedAt: r.analyzed_at
        }))
      });
    } catch (error: any) {
      this.serverError(res, error, 'nvidia getResults');
    }
  }

  getModels(req: Request, res: Response): void {
    const configuredModel = process.env.NVIDIA_MODEL || 'nvidia/nemotron-3-nomo-omni-30b-a3b-reasoning';
    const apiKey = process.env.NVIDIA_API_KEY ? 'configured' : 'not set';
    const availableModels = [
      { id: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning', name: 'Nemotron 3 Nano Omni', description: 'Multimodal model with vision and reasoning capabilities', recommended: true },
      { id: 'nvidia/nemotron-4-mini-holodeck', name: 'Nemotron 4 Mini Holodeck', description: 'Latest multimodal model with enhanced vision understanding' },
      { id: 'meta/llama-3.2-90b-vision-instruct', name: 'Llama 3.2 90B Vision', description: 'Meta\'s large vision model for instruction following' },
      { id: 'google/gemma-2-27b-it', name: 'Gemma 2 27B', description: 'Google\'s instruction-tuned vision model' }
    ];
    res.json({ success: true, configured: { model: configuredModel, apiKeyStatus: apiKey }, available: availableModels });
  }

  updateConfig(req: Request, res: Response): void {
    try {
      const { model } = req.body;
      if (!model) { this.badRequest(res, 'model is required'); return; }
      process.env.NVIDIA_MODEL = model;
      this.ok(res, { message: `Model updated to: ${model}`, note: 'This change is temporary for the current session' });
    } catch (error: any) {
      this.serverError(res, error, 'nvidia updateConfig');
    }
  }

  async analyzeWithBboxes(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const { image, imagePath: imgPath, cameraId, cameraName, triggerReason, eventType, detectedObjects, confidence, timestamp } = req.body;

      if (!image && !imgPath) { this.badRequest(res, 'Either "image" (base64) or "imagePath" (file path) is required'); return; }

      let imageInput: string;
      if (image) {
        imageInput = image;
      } else if (imgPath) {
        imageInput = path.isAbsolute(imgPath) ? imgPath : path.join(process.cwd(), imgPath);
        if (!fs.existsSync(imageInput)) { this.badRequest(res, `Image file not found: ${imgPath}`); return; }
      }

      const context = { cameraId, cameraName, triggerReason, eventType, detectedObjects, confidence, timestamp: timestamp || new Date().toISOString() };
      const result = await analyzeWithBoundingBoxes(imageInput!, context);
      const totalTime = Date.now() - startTime;

      res.json({
        success: true, boxes: result.boxes, sceneDescription: result.sceneDescription,
        annotatedImage: result.annotatedImage ? `data:image/jpeg;base64,${result.annotatedImage}` : null,
        rawAnalysis: result.rawAnalysis,
        metadata: { processingTime: totalTime, modelUsed: result.modelUsed, timestamp: new Date().toISOString(), cameraId, cameraName }
      });
    } catch (error: any) {
      this.serverError(res, error, 'analyzeWithBboxes');
    }
  }

  async analyzePersons(req: Request, res: Response): Promise<void> {
    try {
      const startTime = Date.now();
      const { image, imagePath: imgPath, cameraId, cameraName, triggerReason, eventType, onlyOnMotion, timestamp, eventId } = req.body;

      if (!image && !imgPath) { this.badRequest(res, 'Either "image" (base64) or "imagePath" (file path) is required'); return; }

      const eventIdentifier = eventId || imgPath?.split('/').pop()?.replace('.jpg', '') || `analysis_${Date.now()}`;
      const { AppDataSource } = await import('../database.js');

      try {
        const cachedResult = await AppDataSource.query(`SELECT * FROM ai_analysis_results WHERE event_id = $1 LIMIT 1`, [eventIdentifier]);
        if (cachedResult && cachedResult.length > 0) {
          res.json({
            success: true, count: cachedResult[0].detected_people ? JSON.parse(cachedResult[0].detected_people).length : 0,
            people: cachedResult[0].detected_people ? JSON.parse(cachedResult[0].detected_people) : [],
            sceneDescription: cachedResult[0].scene_description,
            threatAssessment: { level: cachedResult[0].threat_level },
            metadata: { processingTime: cachedResult[0].processing_time_ms, modelUsed: cachedResult[0].model_used, timestamp: cachedResult[0].analyzed_at, cameraId: cachedResult[0].camera_id, cameraName: cachedResult[0].camera_id, cached: true }
          });
          return;
        }
      } catch (cacheError) {
        // proceed without cache
      }

      let imageInput: string;
      if (image) {
        imageInput = image;
      } else if (imgPath) {
        imageInput = path.isAbsolute(imgPath) ? imgPath : path.join(process.cwd(), imgPath);
        if (!fs.existsSync(imageInput)) { this.badRequest(res, `Image file not found: ${imgPath}`); return; }
      }

      const context = { cameraId, cameraName, triggerReason, eventType, timestamp: timestamp || new Date().toISOString() };
      const result = await analyzePersons(imageInput!, context);
      const totalTime = Date.now() - startTime;

      try {
        await AppDataSource.query(
          `INSERT INTO ai_analysis_results (event_id, event_filename, camera_id, scene_description, threat_level, threat_confidence, detected_people, detected_vehicles, detected_objects, bounding_boxes, recommended_actions, model_used, processing_time_ms, analyzed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
           ON CONFLICT (event_id) DO UPDATE SET scene_description = EXCLUDED.scene_description, threat_level = EXCLUDED.threat_level, detected_people = EXCLUDED.detected_people, bounding_boxes = EXCLUDED.bounding_boxes, analyzed_at = NOW()`,
          [eventIdentifier, imgPath?.split('/').pop() || null, cameraId || cameraName || null, result.sceneDescription || null, 'low', result.people?.length > 0 ? 70 : 30, JSON.stringify(result.people || []), '[]', '[]', JSON.stringify(result.people?.map((p: any) => p.position) || []), JSON.stringify(['Review if person detected']), result.modelUsed, totalTime]
        );
      } catch (saveError) {
        logger.error('[NVIDIA Controller] Failed to save analysis', 'NVIDIA', saveError);
      }

      res.json({
        success: true, count: result.count, people: result.people, sceneDescription: result.sceneDescription,
        metadata: { processingTime: totalTime, modelUsed: result.modelUsed, timestamp: new Date().toISOString(), cameraId, cameraName, triggeredOnMotion: onlyOnMotion || false }
      });
    } catch (error: any) {
      this.serverError(res, error, 'analyzePersons');
    }
  }

  async analyzeEventWithBboxes(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, includeAnnotatedImage = true } = req.body;
      if (!eventId) { this.badRequest(res, 'eventId is required'); return; }

      const { AppDataSource } = await import('../database.js');
      const { Event } = await import('../models/index.js');
      const eventRepository = AppDataSource.getRepository(Event);
      const event = await eventRepository.findOne({ where: { id: eventId } });
      if (!event) { this.notFound(res, 'Event not found'); return; }

      let imagePath: string | null = null;
      if (event.file_path) {
        const storedPath = event.file_path;
        const filename = path.basename(storedPath);
        const possiblePaths: string[] = [];

        if (path.isAbsolute(storedPath)) {
          if (storedPath.startsWith('/app/data/')) {
            possiblePaths.push(storedPath.replace('/app/', path.join(process.cwd(), '..') + '/'));
            possiblePaths.push(storedPath.replace('/app/', process.cwd() + '/'));
          }
          possiblePaths.push(storedPath);
        }
        possiblePaths.push(path.join(process.cwd(), storedPath), path.join(process.cwd(), '..', storedPath));
        possiblePaths.push(path.join(process.cwd(), 'public', 'events', filename), path.join(process.cwd(), 'public', filename));

        const dateMatch = filename.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (dateMatch) {
          const yearMonth = `${dateMatch[1]}-${dateMatch[2]}`;
          const eventTypeDir = storedPath.includes('/faces/') ? 'faces' : 'motion';
          possiblePaths.push(
            path.join(process.cwd(), 'data', 'detections', yearMonth, 'events', eventTypeDir, filename),
            path.join(process.cwd(), '..', 'data', 'detections', yearMonth, 'events', eventTypeDir, filename),
            `/app/data/detections/${yearMonth}/events/${eventTypeDir}/${filename}`,
          );
        }

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) { imagePath = p; break; }
        }
      }

      if (!imagePath) { this.badRequest(res, 'Event image file not found'); return; }

      const context = {
        cameraId: event.camera_id,
        cameraName: event.camera_id === 'cam1' ? 'Front Door' : event.camera_id === 'cam2' ? 'Back Door' : undefined,
        triggerReason: 'event bbox analysis',
        eventType: event.event_type,
        detectedObjects: event.object_detections.map(d => d.class),
        confidence: event.confidence,
        timestamp: event.timestamp.toString()
      };

      const result = await analyzeWithBoundingBoxes(imagePath, context);

      res.json({
        success: true, boxes: result.boxes, sceneDescription: result.sceneDescription,
        annotatedImage: includeAnnotatedImage && result.annotatedImage ? `data:image/jpeg;base64,${result.annotatedImage}` : null,
        rawAnalysis: result.rawAnalysis,
        event: { id: event.id, eventType: event.event_type, cameraId: event.camera_id, timestamp: event.timestamp },
        metadata: { processingTime: result.processingTime, modelUsed: result.modelUsed }
      });
    } catch (error: any) {
      this.serverError(res, error, 'analyzeEventWithBboxes');
    }
  }
}

export const nvidiaController = new NvidiaController();
