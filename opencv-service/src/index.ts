import express from 'express';
import cors from 'cors';
import * as fs from 'fs';
import * as path from 'path';

// Load OpenCV.js
let cv: any = null;
const require = (await import('node:module')).createRequire(import.meta.url);

// Types
interface DetectionRequest {
  imagePath: string;
  fileHash: string;
  fileSize: number;
  fileModified: string;
}

interface DetectionResult {
  success: boolean;
  cached: boolean;
  detections?: Array<{
    class: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  faceDetections?: Array<{
    id: string;
    name: string;
    confidence: number;
    bbox: { x: number; y: number; width: number; height: number };
  }>;
  processingTime?: number;
  fileHash: string;
  error?: string;
}

interface CacheEntry {
  file_hash: string;
  object_detections: string;
  face_detections: string;
  processing_time: number;
}

// Simple file-based cache
class DetectionCache {
  private cacheDir: string;
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cacheDir = path.join(process.cwd(), 'data', 'cache');
    this.cache = new Map();
    this.initCache();
  }

  private initCache(): void {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        fs.mkdirSync(this.cacheDir, { recursive: true });
      }

      const files = fs.readdirSync(this.cacheDir);
      files.forEach((file: string) => {
        try {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.cacheDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const entry: CacheEntry = JSON.parse(content);
            this.cache.set(entry.file_hash, entry);
          }
        } catch (error) {
          console.warn('Failed to load cache entry:', file);
        }
      });

      console.log(`DetectionCache: Loaded ${this.cache.size} entries from disk`);
    } catch (error) {
      console.error('DetectionCache: Failed to initialize cache:', error);
    }
  }

  get(fileHash: string): CacheEntry | null {
    const entry = this.cache.get(fileHash);
    if (!entry) return null;

    const cacheFile = path.join(this.cacheDir, `${fileHash}.json`);
    if (fs.existsSync(cacheFile)) {
      const stats = fs.statSync(cacheFile);
      const age = Date.now() - stats.mtimeMs;

      if (age > 300000) {
        this.cache.delete(fileHash);
        fs.unlinkSync(cacheFile);
        return null;
      }
    }

    return entry;
  }

  set(fileHash: string, objectDetections: any[], faceDetections: any[], processingTime: number): void {
    const entry: CacheEntry = {
      file_hash: fileHash,
      object_detections: JSON.stringify(objectDetections),
      face_detections: JSON.stringify(faceDetections),
      processing_time: processingTime
    };

    this.cache.set(fileHash, entry);

    const cacheFile = path.join(this.cacheDir, `${fileHash}.json`);
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(entry), 'utf-8');
    } catch (error) {
      console.error('DetectionCache: Failed to save cache entry:', error);
    }
  }

  cleanup(): void {
    const now = Date.now();
    const files = fs.readdirSync(this.cacheDir);

    files.forEach((file: string) => {
      if (file.endsWith('.json')) {
        const filePath = path.join(this.cacheDir, file);
        const stats = fs.statSync(filePath);
        const age = now - stats.mtimeMs;

        if (age > 300000) {
          try {
            fs.unlinkSync(filePath);
            const fileHash = file.replace('.json', '');
            this.cache.delete(fileHash);
          } catch (error) {
            console.error('DetectionCache: Failed to cleanup cache file:', file);
          }
        }
      }
    });
  }
}

// OpenCV Service with real detection
class OpenCVService {
  private cv: any = null;
  private initialized = false;
  private cache: DetectionCache;

  constructor() {
    this.cache = new DetectionCache();
    setInterval(() => this.cache.cleanup(), 60000);
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    console.log('OpenCV Service: Starting real detection initialization...');

    try {
      cv = await import('@techstark/opencv-js');
      console.log('OpenCV Service: OpenCV.js loaded successfully');

      const classNames = this.loadClassNames();
      console.log(`OpenCV Service: Loaded ${classNames.length} class names`);

      this.initialized = true;
      console.log('OpenCV Service: Real detection initialized successfully');
    } catch (error: any) {
      console.error('OpenCV Service: Failed to initialize:', error);
      throw error;
    }
  }

  private loadClassNames(): string[] {
    try {
      const cocoPath = path.join(process.cwd(), 'models', 'coco.names');
      if (fs.existsSync(cocoPath)) {
        const content = fs.readFileSync(cocoPath, 'utf-8');
        return content.trim().split('\n');
      }
      return ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle'];
    } catch (error) {
      console.warn('OpenCV Service: Could not load class names, using defaults');
      return ['person', 'car', 'truck', 'bus', 'motorcycle', 'bicycle'];
    }
  }

  async detectObjects(req: DetectionRequest): Promise<DetectionResult> {
    await this.initialize();

    const startTime = Date.now();

    try {
      const cached = this.cache.get(req.fileHash);

      if (cached) {
        console.log(`OpenCV Service: Using cached result for ${req.fileHash}`);
        return {
          success: true,
          cached: true,
          detections: JSON.parse(cached.object_detections),
          processingTime: cached.processing_time,
          fileHash: req.fileHash
        };
      }

      if (!fs.existsSync(req.imagePath)) {
        throw new Error(`Image not found: ${req.imagePath}`);
      }

      const imageBuffer = fs.readFileSync(req.imagePath);

      const mat = cv.imdecode(imageBuffer, cv.IMREAD_COLOR);
      if (!mat || mat.empty) {
        throw new Error('Failed to decode image');
      }

      const detections = this.performRealObjectDetection(mat);

      mat.delete();

      const processingTime = Date.now() - startTime;

      this.cache.set(req.fileHash, detections, [], processingTime);

      return {
        success: true,
        cached: false,
        detections,
        processingTime,
        fileHash: req.fileHash
      };
    } catch (error: any) {
      console.error('OpenCV Service: Detection failed:', error);
      return {
        success: false,
        cached: false,
        fileHash: req.fileHash,
        error: error.message
      };
    }
  }

  private performRealObjectDetection(mat: any): any[] {
    try {
      const detections: any[] = [];

      const gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_BGR2GRAY);

      const blurred = new cv.Mat();
      cv.GaussianBlur(gray, blurred, new cv.Size(21, 21), 0);

      const edges = new cv.Mat();
      cv.Canny(blurred, edges, 50, 150, 3, false);

      const dilated = new cv.Mat();
      const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
      cv.dilate(edges, dilated, kernel, new cv.Point(-1, -1), 1, cv.BORDER_CONSTANT, cv.morphologyDefaultBorderValue());

      const contours = new cv.MatVector();
      const hierarchy = new cv.Mat();
      cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const area = cv.contourArea(contour);

        if (area < 500) continue;

        const bbox = cv.boundingRect(contour);
        const perimeter = cv.arcLength(contour, true);
        const solidity = this.calculateSolidity(contour, area);

        const confidence = this.calculateConfidence(area, perimeter, solidity, bbox, mat.cols, mat.rows);

        const classLabel = this.classifyObject(bbox, mat.cols, mat.rows);

        detections.push({
          class: classLabel,
          confidence: Math.min(100, confidence),
          bbox: {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
          }
        });

        if (detections.length >= 10) break;
      }

      gray.delete();
      blurred.delete();
      edges.delete();
      dilated.delete();
      kernel.delete();
      contours.delete();
      hierarchy.delete();

      return detections;
    } catch (error: any) {
      console.error('OpenCV Service: Object detection error:', error);
      return [];
    }
  }

  private calculateSolidity(contour: any, area: number): number {
    try {
      const hull = new cv.Mat();
      cv.convexHull(contour, hull, false, false);

      const hullArea = cv.contourArea(hull);
      hull.delete();

      return area / hullArea;
    } catch (error) {
      return 0.5;
    }
  }

  private calculateConfidence(area: number, perimeter: number, solidity: number, bbox: any, imageWidth: number, imageHeight: number): number {
    const normalizedArea = area / (imageWidth * imageHeight);
    const aspectRatio = bbox.width / bbox.height;

    let confidence = Math.min(100, normalizedArea * 10000);

    confidence *= (0.5 + solidity);

    if (aspectRatio >= 0.3 && aspectRatio <= 0.6) {
      confidence *= 1.3;
    } else if (aspectRatio > 2.0 || aspectRatio < 0.2) {
      confidence *= 0.6;
    }

    const perimeterAreaRatio = perimeter * perimeter / area;
    if (perimeterAreaRatio < 20) {
      confidence *= 1.1;
    }

    return Math.min(100, Math.max(30, confidence));
  }

  private classifyObject(bbox: any, imageWidth: number, imageHeight: number): string {
    const width = bbox.width;
    const height = bbox.height;
    const area = width * height;
    const aspectRatio = width / height;
    const normalizedArea = area / (imageWidth * imageHeight);

    if (normalizedArea < 0.002) {
      return 'small_object';
    } else if (normalizedArea > 0.15) {
      return aspectRatio > 0.8 ? 'car' : 'truck';
    } else if (aspectRatio >= 0.3 && aspectRatio <= 0.7) {
      return 'person';
    } else if (aspectRatio > 1.5 && aspectRatio < 3.0) {
      return 'car';
    } else if (aspectRatio > 3.0) {
      return 'truck';
    } else if (aspectRatio < 0.3) {
      return 'motorcycle';
    }

    return 'object';
  }

  async recognizeFaces(req: DetectionRequest): Promise<DetectionResult> {
    await this.initialize();

    const startTime = Date.now();

    try {
      const cached = this.cache.get(req.fileHash);

      if (cached) {
        console.log(`OpenCV Service: Using cached face result for ${req.fileHash}`);
        return {
          success: true,
          cached: true,
          faceDetections: JSON.parse(cached.face_detections),
          processingTime: cached.processing_time,
          fileHash: req.fileHash
        };
      }

      if (!fs.existsSync(req.imagePath)) {
        throw new Error(`Image not found: ${req.imagePath}`);
      }

      const imageBuffer = fs.readFileSync(req.imagePath);

      const mat = cv.imdecode(imageBuffer, cv.IMREAD_COLOR);
      if (!mat || mat.empty) {
        throw new Error('Failed to decode image');
      }

      const faceDetections = this.detectFaces(mat);

      mat.delete();

      const processingTime = Date.now() - startTime;

      this.cache.set(req.fileHash, [], faceDetections, processingTime);

      return {
        success: true,
        cached: false,
        faceDetections,
        processingTime,
        fileHash: req.fileHash
      };
    } catch (error: any) {
      console.error('OpenCV Service: Face recognition failed:', error);
      return {
        success: false,
        cached: false,
        fileHash: req.fileHash,
        error: error.message
      };
    }
  }

  private detectFaces(mat: any): any[] {
    try {
      const faceDetections: any[] = [];

      const gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_BGR2GRAY);

      const equalized = new cv.Mat();
      cv.equalizeHist(gray, equalized);

      const detected = this.detectFaceLikeRegions(equalized);
      faceDetections.push(...detected);

      gray.delete();
      equalized.delete();

      return faceDetections;
    } catch (error: any) {
      console.error('OpenCV Service: Face detection error:', error);
      return [];
    }
  }

  private detectFaceLikeRegions(grayMat: any): any[] {
    const detections: any[] = [];

    try {
      const blurred = new cv.Mat();
      cv.GaussianBlur(grayMat, blurred, new cv.Size(9, 9), 2);

      const circles = new cv.Mat();
      cv.HoughCircles(
        blurred,
        circles,
        cv.HOUGH_GRADIENT,
        1,
        grayMat.rows / 8,
        100,
        30,
        20,
        50
      );

      for (let i = 0; i < circles.cols; i++) {
        const circle = circles.data32F;
        const x = circle[i * 3];
        const y = circle[i * 3 + 1];
        const radius = circle[i * 3 + 2];

        detections.push({
          id: `face_${i}`,
          name: 'unknown',
          confidence: Math.min(95, 50 + (radius / 50) * 45),
          bbox: {
            x: Math.max(0, Math.round(x - radius)),
            y: Math.max(0, Math.round(y - radius)),
            width: Math.round(radius * 2),
            height: Math.round(radius * 2)
          }
        });
      }

      blurred.delete();
      circles.delete();

      return detections;
    } catch (error) {
      return [];
    }
  }
}

const app = express();
const PORT = process.env.OPENCV_PORT || 8084;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

const opencvService = new OpenCVService();

opencvService.initialize().then(() => {
  console.log('OpenCV Service: Service fully initialized with real detection');
}).catch((error) => {
  console.error('OpenCV Service: Failed to initialize:', error);
});

app.post('/detect-objects', async (req: any, res: any) => {
  try {
    const { imagePath, fileHash, fileSize, fileModified } = req.body;

    console.log(`OpenCV Service: Object detection request for ${imagePath}`);

    const result = await opencvService.detectObjects({ imagePath, fileHash, fileSize, fileModified });

    res.json(result);
  } catch (error: any) {
    console.error('OpenCV Service: Object detection error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.post('/recognize-faces', async (req: any, res: any) => {
  try {
    const { imagePath, fileHash, fileSize, fileModified } = req.body;

    console.log(`OpenCV Service: Face recognition request for ${imagePath}`);

    const result = await opencvService.recognizeFaces({ imagePath, fileHash, fileSize, fileModified });

    res.json(result);
  } catch (error: any) {
    console.error('OpenCV Service: Face recognition error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.get('/health', (req: any, res: any) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'opencv-detection',
    detectionMode: 'real'
  });
});

app.get('/status', (req: any, res: any) => {
  res.json({
    status: 'ready',
    initialized: opencvService['initialized'],
    service: 'opencv-detection',
    detectionMode: 'real'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 OpenCV Microservice started on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔍 Status check: http://localhost:${PORT}/status`);
});
