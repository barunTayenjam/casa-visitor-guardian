import { EventEmitter } from 'events';
import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import * as cv from '@techstark/opencv-js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Face recognition interface
export interface FaceDetection {
  id: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  embedding?: number[]; // Face embedding for recognition
  landmark?: {
    leftEye: [number, number];
    rightEye: [number, number];
    nose: [number, number];
    mouth: [number, number];
  };
}

// Known person interface
export interface KnownPerson {
  id: string;
  name: string;
  description?: string;
  isFamily: boolean;
  isAuthorized: boolean;
  createdAt: string;
  lastSeen?: string;
  faceCount: number;
  embeddings: number[][]; // Multiple face embeddings per person
}

// Face recognition event
export interface FaceRecognitionEvent {
  id: string;
  cameraId: string;
  timestamp: string;
  faces: FaceDetection[];
  knownFaces: Array<FaceDetection & { person: KnownPerson; matchConfidence: number }>;
  unknownFaces: FaceDetection[];
  imagePath: string;
  processingTime: number;
  metadata: {
    totalFaces: number;
    knownCount: number;
    unknownCount: number;
    hasUnauthorizedPerson: boolean;
  };
}

// Face recognition settings
export interface FaceRecognitionSettings {
  enabled: boolean;
  minFaceSize: number;
  recognitionThreshold: number; // 0-1, lower = more strict
  saveUnknownFaces: boolean;
  maxFacesPerFrame: number;
  // enableLivenessDetection: boolean;
}

type KnownFace = FaceDetection & { person: KnownPerson; matchConfidence: number };

export class FacialRecognitionService extends EventEmitter {
  private db: Database | null = null;
  private settings = new Map<string, FaceRecognitionSettings>();
  private modelLoaded = false;
  private processingQueue: Array<{
    cameraId: string;
    frame: Buffer;
    timestamp: number;
    resolve: (result: FaceRecognitionEvent | null) => void;
    reject: (error: Error) => void;
  }> = [];
  private isProcessing = false;
  private classifier: any; // OpenCV Cascade Classifier
  private cv: any;
  private isInitialized!: Promise<void>;

  constructor() {
    super();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      this.cv = await (await import('@techstark/opencv-js')).default;
      this.initializeDefaultSettings();
      await this.initializeDatabase();
      await this.loadModel();
      this.emit('ready');
    } catch (error) {
      console.error('Failed to initialize facial recognition service:', error);
      this.emit('error', error);
    }
  }

  // Initialize default settings
  private initializeDefaultSettings(): void {
    const defaultSettings: FaceRecognitionSettings = {
      enabled: true,
      minFaceSize: 48,
      recognitionThreshold: 0.6,
      saveUnknownFaces: true,
      maxFacesPerFrame: 5,
      // enableLivenessDetection: false
    };

    this.settings.set('default', defaultSettings);
  }

  // Initialize SQLite database for known faces
  private async initializeDatabase(): Promise<void> {
    try {
      const dbPath = path.join(__dirname, '../../data/faces.db');
      const dataDir = path.dirname(dbPath);
      
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      this.db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Create tables
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS known_persons (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          is_family BOOLEAN DEFAULT 0,
          is_authorized BOOLEAN DEFAULT 1,
          created_at TEXT NOT NULL,
          last_seen TEXT,
          face_count INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS face_embeddings (
          id TEXT PRIMARY KEY,
          person_id TEXT NOT NULL,
          embedding_data TEXT NOT NULL, -- JSON string of embedding array
          created_at TEXT NOT NULL,
          FOREIGN KEY (person_id) REFERENCES known_persons (id)
        );

        CREATE INDEX IF NOT EXISTS idx_face_embeddings_person_id ON face_embeddings(person_id);
      `);

      console.log('Face recognition database initialized');
    } catch (error) {
      console.error('Failed to initialize face recognition database:', error);
      this.emit('databaseError', error);
    }
  }

  // Load face recognition model
  private async loadModel(): Promise<void> {
    try {
      console.log('Loading face recognition model...');
      
      // Try multiple path resolutions for better compatibility
      const possiblePaths = [
        path.join(__dirname, '../models/haarcascade_frontalface_default.xml'),
        path.join(process.cwd(), 'src/models/haarcascade_frontalface_default.xml'),
        path.join(process.cwd(), 'server/src/models/haarcascade_frontalface_default.xml'),
        path.resolve('./server/src/models/haarcascade_frontalface_default.xml'),
        '/Users/baruntayenjam/Code/home-security/server/src/models/haarcascade_frontalface_default.xml'
      ];
      
      let modelPath = '';
      let foundPath = false;
      
      for (const testPath of possiblePaths) {
        console.log(`Testing path: ${testPath}`);
        if (fs.existsSync(testPath)) {
          const stats = fs.statSync(testPath);
          console.log(`Found model at: ${testPath} (size: ${stats.size} bytes)`);
          modelPath = testPath;
          foundPath = true;
          break;
        }
      }
      
      if (!foundPath) {
        throw new Error('Haar cascade model file not found in any expected location');
      }

      this.classifier = new this.cv.CascadeClassifier();
      
      // Try to load the classifier with multiple approaches
      let loaded = false;
      
      // First try with the resolved path
      loaded = this.classifier.load(modelPath);
      console.log('Initial classifier load result:', loaded);
      
      // If that fails, try absolute path
      if (!loaded && !path.isAbsolute(modelPath)) {
        const absolutePath = path.resolve(modelPath);
        console.log('Trying absolute path:', absolutePath);
        loaded = this.classifier.load(absolutePath);
        console.log('Absolute path classifier load result:', loaded);
      }
      
      // If still fails, try reading the file content and creating a temporary file
      if (!loaded) {
        try {
          const modelContent = fs.readFileSync(modelPath, 'utf8');
          const tempPath = path.join(process.env.TMPDIR || '/tmp', 'haarcascade_frontalface_default.xml');
          fs.writeFileSync(tempPath, modelContent);
          console.log('Trying temporary file:', tempPath);
          loaded = this.classifier.load(tempPath);
          console.log('Temporary file classifier load result:', loaded);
        } catch (tempError) {
          console.warn('Failed to create temporary file:', tempError);
        }
      }
      
      console.log('Final classifier load result:', loaded);
      
      if (!loaded) {
        console.error('All attempts to load Haar cascade classifier failed');
        throw new Error('Failed to load Haar cascade classifier after multiple attempts');
      }
      
      this.modelLoaded = true;
      console.log('Face recognition model loaded successfully');
      this.emit('modelLoaded');
    } catch (error) {
      console.error('Failed to load face recognition model:', error);
      console.warn('Face detection will be disabled');
      this.modelLoaded = false; // Set to false instead of throwing
      this.emit('modelError', error);
    }
  }

  // Update settings for a camera
  updateSettings(cameraId: string, settings: Partial<FaceRecognitionSettings>): boolean {
    const currentSettings = this.settings.get(cameraId) || this.settings.get('default');
    if (!currentSettings) {
      return false;
    }

    const updatedSettings = { ...currentSettings, ...settings };
    this.settings.set(cameraId, updatedSettings);
    return true;
  }

  // Get settings for a camera
  getSettings(cameraId: string): FaceRecognitionSettings | null {
    return this.settings.get(cameraId) || this.settings.get('default') || null;
  }

  // Process frame for face detection and recognition
  async recognizeFaces(frame: Buffer, cameraId?: string): Promise<FaceRecognitionEvent | null> {
    await this.isInitialized;
    if (!this.modelLoaded) {
      console.warn('Face recognition model not loaded yet');
      return null;
    }

    const settings = this.getSettings(cameraId || 'default');
    if (!settings || !settings.enabled) {
      return null;
    }

    return new Promise((resolve, reject) => {
      this.processingQueue.push({
        cameraId,
        frame,
        timestamp: Date.now(),
        resolve,
        reject
      });

      if (!this.isProcessing) {
        this.processQueue();
      }
    });
  }

  // Process face recognition queue
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.processingQueue.length > 0) {
      const item = this.processingQueue.shift()!;
      
      try {
        const result = await this.processFrame(item.cameraId, item.frame, item.timestamp);
        item.resolve(result);
      } catch (error) {
        item.reject(error as Error);
      }
    }

    this.isProcessing = false;
  }

  // Process individual frame for face recognition
  private async processFrame(cameraId: string, frame: Buffer, timestamp: number): Promise<FaceRecognitionEvent | null> {
    const startTime = Date.now();
    const settings = this.getSettings(cameraId);
    
    if (!settings) {
      return null;
    }

    try {
      // Detect faces in frame
      const faces = await this.detectFaces(frame, settings);
      
      if (faces.length === 0) {
        return null;
      }

      // Limit number of faces per frame
      const limitedFaces = faces.slice(0, settings.maxFacesPerFrame);

      // Recognize faces
      const recognitionResults = await this.matchFacesWithKnownPersons(limitedFaces, settings);

      // Save detection image
      const imagePath = await this.saveFaceImage(cameraId, frame, recognitionResults.allFaces, timestamp);

      // Update last seen for known persons
      await this.updateLastSeen(recognitionResults.knownFaces);

      const event: FaceRecognitionEvent = {
        id: `faces_${cameraId}_${timestamp}`,
        cameraId,
        timestamp: new Date(timestamp).toISOString(),
        faces: recognitionResults.allFaces,
        knownFaces: recognitionResults.knownFaces,
        unknownFaces: recognitionResults.unknownFaces,
        imagePath,
        processingTime: Date.now() - startTime,
        metadata: {
          totalFaces: recognitionResults.allFaces.length,
          knownCount: recognitionResults.knownFaces.length,
          unknownCount: recognitionResults.unknownFaces.length,
          hasUnauthorizedPerson: recognitionResults.knownFaces.some((f: KnownFace) => !f.person.isAuthorized)
        }
      };

      console.log(`Face recognition: ${recognitionResults.knownFaces.length} known, ${recognitionResults.unknownFaces.length} unknown faces on ${cameraId}`);
      return event;

    } catch (error) {
      console.error(`Error in face recognition for ${cameraId}:`, error);
      return null;
    }
  }

  // Detect faces in frame (real implementation)
  private async detectFaces(frame: Buffer, settings: FaceRecognitionSettings): Promise<FaceDetection[]> {
    // Check if model is loaded
    if (!this.modelLoaded || !this.classifier) {
      return [];
    }

    try {
      // Convert buffer to raw RGBA data using sharp
      const { data, info } = await sharp(frame)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      
      // Create OpenCV Mat from raw image data
      const src = new this.cv.Mat(info.height, info.width, this.cv.CV_8UC4);
      src.data.set(data);
      const gray = new this.cv.Mat();
      this.cv.cvtColor(src, gray, this.cv.COLOR_RGBA2GRAY, 0);

      const faces = new this.cv.RectVector();
      const msize = new this.cv.Size(settings.minFaceSize, settings.minFaceSize);
      this.classifier.detectMultiScale(gray, faces, 1.1, 3, 0, msize);

      const detectedFaces: FaceDetection[] = [];
      for (let i = 0; i < faces.size(); ++i) {
        const rect = faces.get(i);
        detectedFaces.push({
          id: `face_${Date.now()}_${i}`,
          bbox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
          confidence: 0.9, // Haar cascades don't provide confidence, so we use a default value
        });
      }

      src.delete();
      gray.delete();
      faces.delete();

      return detectedFaces;
    } catch (error) {
      console.error('Face detection error:', error);
      return [];
    }
  }

  // Recognize faces against known persons
  private async matchFacesWithKnownPersons(
    faces: FaceDetection[], 
    settings: FaceRecognitionSettings
  ): Promise<{
    allFaces: FaceDetection[];
    knownFaces: Array<FaceDetection & { person: KnownPerson; matchConfidence: number }>;
    unknownFaces: FaceDetection[];
  }> {
    if (!this.db) {
      return { allFaces: faces, knownFaces: [], unknownFaces: faces };
    }

    const knownFaces: Array<FaceDetection & { person: KnownPerson; matchConfidence: number }> = [];
    const unknownFaces: FaceDetection[] = [];

    for (const face of faces) {
      // Generate mock embedding for face
      const embedding = this.generateMockEmbedding();
      
      // Try to match against known persons
      const match = await this.findBestMatch(embedding, settings.recognitionThreshold);
      
      if (match) {
        knownFaces.push({
          ...face,
          embedding,
          person: match.person,
          matchConfidence: match.confidence
        });
      } else {
        unknownFaces.push({
          ...face,
          embedding
        });
      }
    }

    return { allFaces: faces, knownFaces, unknownFaces };
  }

  // Generate mock face embedding (128-dimensional vector)
  private generateMockEmbedding(): number[] {
    return Array.from({ length: 128 }, () => Math.random());
  }

  // Find best match for face embedding
  private async findBestMatch(
    embedding: number[], 
    threshold: number
  ): Promise<{ person: KnownPerson; confidence: number } | null> {
    if (!this.db) return null;

    try {
      // Get all known persons with their embeddings
      const persons = await this.db.all(`
        SELECT p.*, e.embedding_data
        FROM known_persons p
        LEFT JOIN face_embeddings e ON p.id = e.person_id
        WHERE p.is_authorized = 1
      `);

      let bestMatch: { person: KnownPerson; confidence: number } | null = null;

      for (const row of persons) {
        if (!row.embedding_data) continue;

        const knownEmbedding = JSON.parse(row.embedding_data);
        const similarity = this.calculateCosineSimilarity(embedding, knownEmbedding);
        
        if (similarity > threshold && (!bestMatch || similarity > bestMatch.confidence)) {
          bestMatch = {
            person: {
              id: row.id,
              name: row.name,
              description: row.description,
              isFamily: Boolean(row.is_family),
              isAuthorized: Boolean(row.is_authorized),
              createdAt: row.created_at,
              lastSeen: row.last_seen,
              faceCount: row.face_count,
              embeddings: [] // Would load all embeddings in real implementation
            },
            confidence: similarity
          };
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error finding face match:', error);
      return null;
    }
  }

  // Calculate cosine similarity between two embeddings
  private calculateCosineSimilarity(embedding1: number[], embedding2: number[]): number {
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  // Save face detection image
  private async saveFaceImage(
    cameraId: string, 
    frame: Buffer, 
    faces: FaceDetection[], 
    timestamp: number
  ): Promise<string> {
    const eventsDir = path.join(__dirname, '../../public/events');
    if (!fs.existsSync(eventsDir)) {
      fs.mkdirSync(eventsDir, { recursive: true });
    }

    const filename = `faces_${cameraId}_${timestamp}.jpg`;
    const filepath = path.join(eventsDir, filename);

    await fs.promises.writeFile(filepath, frame);
    return `/events/${filename}`;
  }

  // Update last seen timestamp for known persons
  private async updateLastSeen(knownFaces: Array<FaceDetection & { person: KnownPerson; matchConfidence: number }>): Promise<void> {
    if (!this.db || knownFaces.length === 0) return;

    try {
      const now = new Date().toISOString();
      for (const face of knownFaces) {
        await this.db.run(
          'UPDATE known_persons SET last_seen = ? WHERE id = ?',
          [now, face.person.id]
        );
      }
    } catch (error) {
      console.error('Error updating last seen:', error);
    }
  }

  // Add new known person
  async addKnownPerson(person: Omit<KnownPerson, 'id' | 'createdAt' | 'faceCount' | 'embeddings'>, imagePath?: string): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.db.run(
      `INSERT INTO known_persons (id, name, description, is_family, is_authorized, created_at, face_count)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [id, person.name, person.description, person.isFamily ? 1 : 0, person.isAuthorized ? 1 : 0, now]
    );

    return id;
  }

  // Get all known persons
  async getKnownPersons(): Promise<KnownPerson[]> {
    if (!this.db) return [];

    try {
      const rows = await this.db.all('SELECT * FROM known_persons ORDER BY name');
      return rows.map((row: KnownPersonRow) => ({
        id: row.id,
        name: row.name,
        description: row.description || undefined,
        isFamily: Boolean(row.is_family),
        isAuthorized: Boolean(row.is_authorized),
        createdAt: row.created_at,
        lastSeen: row.last_seen || undefined,
        faceCount: row.face_count,
        embeddings: [] // Would load embeddings in real implementation
      }));
    } catch (error) {
      console.error('Error getting known persons:', error);
      return [];
    }
  }

  // Check if model is ready
  isReady(): boolean {
    return this.modelLoaded && this.db !== null;
  }

  // Get queue status
  getQueueStatus(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing
    };
  }
}

interface KnownPersonRow {
  id: string;
  name: string;
  description: string | null;
  is_family: number;
  is_authorized: number;
  created_at: string;
  last_seen: string | null;
  face_count: number;
}

// Singleton instance
export const facialRecognitionService = new FacialRecognitionService();
export default facialRecognitionService;

// Global getter function
export function getFacialRecognitionService(): FacialRecognitionService {
  return facialRecognitionService;
}