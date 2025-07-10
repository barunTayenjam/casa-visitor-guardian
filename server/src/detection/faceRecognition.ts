import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Flag to track if face recognition is available
let faceRecognitionAvailable = false;

// Mock implementations for when modules aren't available
const mockTf = {
  ready: Promise.resolve(),
  setBackend: () => {}
};

const mockFaceapi = {
  nets: {
    ssdMobilenetv1: { loadFromDisk: () => console.log('Mock: ssdMobilenetv1 loaded') },
    faceLandmark68Net: { loadFromDisk: () => console.log('Mock: faceLandmark68Net loaded') },
    faceRecognitionNet: { loadFromDisk: () => console.log('Mock: faceRecognitionNet loaded') }
  },
  detectAllFaces: () => [],
  computeFaceDescriptor: () => []
};

// Declare variables to hold the modules
let tf = mockTf;
let faceapi = mockFaceapi;

// Try to load the real modules
export const loadModules = async () => {
  console.log('Attempting to load face recognition modules...');
  try {
    // Use tfjs-node for Node.js backend and image decoding
    const tfModule = await import('@tensorflow/tfjs-node');
    tf = tfModule;
    console.log('Successfully imported @tensorflow/tfjs-node');
    
    const faceapiModule = await import('@vladmandic/face-api');
    faceapi = faceapiModule;
    console.log('Successfully imported @vladmandic/face-api');
    
    faceRecognitionAvailable = true;
    console.log('Face recognition modules loaded successfully');
  } catch (error) {
    console.error('Error loading face recognition modules:', error);
    console.log('Face recognition will be disabled');
  }
};

// Start loading modules in the background
// loadModules(); // This call will be moved to index.ts

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const eventsDir = path.join(__dirname, '../../public/events');
const snapshotsDir = path.join(__dirname, '../../public/snapshots');
const personsDir = path.join(__dirname, '../../public/persons');

// Ensure persons directory exists
if (!fs.existsSync(personsDir)) {
  fs.mkdirSync(personsDir, { recursive: true });
  console.log(`Created persons directory: ${personsDir}`);
}

// Interface for face detection result
interface FaceDetectionResult {
  faceId: string;
  imagePath: string;
  originalImagePath: string;
  confidence: number;
  timestamp: string;
  descriptors: Float32Array;
}

// Interface for person data
interface Person {
  personId: string;
  faceIds: string[];
  images: string[];
  firstSeen: string;
  lastSeen: string;
}

// Store detected faces
const detectedFaces: Map<string, FaceDetectionResult> = new Map();

// Store identified persons
const identifiedPersons: Map<string, Person> = new Map();

// Face recognition class
export class FaceRecognition {
  private faceDetectionModel: faceapi.FaceDetector | null = null;
  private faceLandmarkModel: faceapi.FaceLandmark68Net | null = null;
  private faceRecognitionModel: faceapi.FaceRecognitionNet | null = null;
  private isModelLoading = false;
  private similarityThreshold = 0.6; // Threshold for face matching

  constructor() {
    // Load models
    this.loadModels();
  }

  // Load face-api.js models
  private async loadModels(): Promise<void> {
    if (this.faceDetectionModel && this.faceLandmarkModel && this.faceRecognitionModel || this.isModelLoading) {
      return;
    }
    
    // Check if face recognition modules are available
    if (!faceRecognitionAvailable) {
      console.log('Face recognition is disabled due to missing dependencies');
      return;
    }
    
    try {
      this.isModelLoading = true;
      console.log('Loading face recognition models...');
      
      // Set model path
      const modelPath = path.join(__dirname, '../../models/face-api');
      
      // Ensure model directory exists
      if (!fs.existsSync(modelPath)) {
        fs.mkdirSync(modelPath, { recursive: true });
      }
      
      // Configure face-api.js to use the models directory
      try {
        await faceapi.tf.setBackend('cpu');
        await faceapi.tf.enableProdMode();
        await faceapi.tf.ENV.set('DEBUG', false);
        await faceapi.tf.ready();
      } catch (error) {
        console.error('Error configuring TensorFlow backend:', error);
        return;
      }
      
      // Check if models exist on disk, otherwise load from CDN
      const modelOptions = { cacheSizeInBytes: 0 };
      
      try {
        // Try to load from disk first
        console.log('Attempting to load models from disk...');
        this.faceDetectionModel = await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
        this.faceLandmarkModel = await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
        this.faceRecognitionModel = await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);
        console.log('Face recognition models loaded from disk successfully');
      } catch (diskError) {
        // If loading from disk fails, load from CDN
        console.log('Loading models from disk failed, loading from CDN instead...');
        this.faceDetectionModel = await faceapi.nets.ssdMobilenetv1.load();
        this.faceLandmarkModel = await faceapi.nets.faceLandmark68Net.load();
        this.faceRecognitionModel = await faceapi.nets.faceRecognitionNet.load();
        console.log('Face recognition models loaded from CDN successfully');
      }
      
      console.log('Face recognition models loaded successfully');
    } catch (error) {
      console.error('Failed to load face recognition models:', error);
    } finally {
      this.isModelLoading = false;
    }
  }

  // Detect faces in an image
  private async detectFaces(imagePath: string): Promise<FaceDetectionResult[]> {
    // Check if face recognition is available
    if (!faceRecognitionAvailable) {
      console.log('Face detection skipped: Face recognition is disabled');
      return [];
    }
    
    if (!this.faceDetectionModel || !this.faceLandmarkModel || !this.faceRecognitionModel) {
      await this.loadModels();
      if (!this.faceDetectionModel || !this.faceLandmarkModel || !this.faceRecognitionModel) {
        console.error('Face recognition models not loaded');
        return [];
      }
    }
    
    try {
      // Read image file
      const imageBuffer = fs.readFileSync(imagePath);
      
      // Convert buffer to tensor
      const img = await faceapi.bufferToImage(imageBuffer);
      
      // Detect all faces and compute descriptors
      const detections = await faceapi
        .detectAllFaces(img)
        .withFaceLandmarks()
        .withFaceDescriptors();
      
      if (detections.length === 0) {
        return [];
      }
      
      // Extract filename from path
      const filename = path.basename(imagePath);
      const timestamp = new Date().toISOString();
      
      // Map detections to results
      return detections.map((detection, index) => {
        const faceId = `face_${filename}_${index}`;
        const confidence = detection.detection.score;
        const descriptors = detection.descriptor;
        
        return {
          faceId,
          imagePath: imagePath,
          originalImagePath: imagePath,
          confidence,
          timestamp,
          descriptors
        };
      });
    } catch (error) {
      console.error(`Error detecting faces in ${imagePath}:`, error);
      return [];
    }
  }

  // Compare face descriptors
  private compareFaces(descriptor1: Float32Array, descriptor2: Float32Array): number {
    return faceapi.euclideanDistance(descriptor1, descriptor2);
  }

  // Find matching person for a face
  private findMatchingPerson(faceDescriptor: Float32Array): string | null {
    let bestMatch: { personId: string; distance: number } | null = null;
    
    // Compare with all identified persons
    for (const [personId, person] of identifiedPersons.entries()) {
      // Get all face descriptors for this person
      for (const faceId of person.faceIds) {
        const face = detectedFaces.get(faceId);
        if (face) {
          const distance = this.compareFaces(faceDescriptor, face.descriptors);
          
          // If distance is below threshold and better than current best match
          if (distance < this.similarityThreshold && (!bestMatch || distance < bestMatch.distance)) {
            bestMatch = { personId, distance };
          }
        }
      }
    }
    
    return bestMatch ? bestMatch.personId : null;
  }

  // Create a new person
  private createNewPerson(face: FaceDetectionResult): string {
    const personId = `person_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const timestamp = new Date().toISOString();
    
    // Create person directory
    const personDir = path.join(personsDir, personId);
    if (!fs.existsSync(personDir)) {
      fs.mkdirSync(personDir, { recursive: true });
    }
    
    // Copy image to person directory
    const filename = path.basename(face.imagePath);
    const newImagePath = path.join(personDir, filename);
    fs.copyFileSync(face.imagePath, newImagePath);
    
    // Create person record
    const person: Person = {
      personId,
      faceIds: [face.faceId],
      images: [newImagePath],
      firstSeen: timestamp,
      lastSeen: timestamp
    };
    
    // Add to identified persons
    identifiedPersons.set(personId, person);
    
    console.log(`Created new person: ${personId}`);
    return personId;
  }

  // Add face to existing person
  private addFaceToPerson(personId: string, face: FaceDetectionResult): void {
    const person = identifiedPersons.get(personId);
    if (!person) {
      console.error(`Person ${personId} not found`);
      return;
    }
    
    // Copy image to person directory
    const personDir = path.join(personsDir, personId);
    const filename = path.basename(face.imagePath);
    const newImagePath = path.join(personDir, filename);
    
    // Only copy if not already in person directory
    if (!fs.existsSync(newImagePath)) {
      fs.copyFileSync(face.imagePath, newImagePath);
      
      // Update person record
      person.faceIds.push(face.faceId);
      person.images.push(newImagePath);
      person.lastSeen = new Date().toISOString();
      
      // Update in map
      identifiedPersons.set(personId, person);
      
      console.log(`Added face ${face.faceId} to person ${personId}`);
    }
  }

  // Process a single image
  private async processImage(imagePath: string): Promise<void> {
    // Check if face recognition is available
    if (!faceRecognitionAvailable) {
      console.log('Skipping image processing: Face recognition is disabled');
      return;
    }
    
    try {
      // Detect faces in image
      const faces = await this.detectFaces(imagePath);
      
      // Process each detected face
      for (const face of faces) {
        // Add to detected faces map
        detectedFaces.set(face.faceId, face);
        
        // Find matching person
        const matchingPersonId = this.findMatchingPerson(face.descriptors);
        
        if (matchingPersonId) {
          // Add face to existing person
          this.addFaceToPerson(matchingPersonId, face);
        } else {
          // Create new person
          this.createNewPerson(face);
        }
      }
    } catch (error) {
      console.error(`Error processing image ${imagePath}:`, error);
    }
  }

  // Process all images in events and snapshots directories
  public async processAllImages(): Promise<{ totalImages: number, processedImages: number, personsIdentified: number }> {
    // Check if face recognition is available
    if (!faceRecognitionAvailable) {
      console.log('Face recognition is disabled due to missing dependencies');
      return { totalImages: 0, processedImages: 0, personsIdentified: 0 };
    }
    
    // Ensure models are loaded
    if (!this.faceDetectionModel || !this.faceLandmarkModel || !this.faceRecognitionModel) {
      await this.loadModels();
      
      // If models still not loaded, return
      if (!this.faceDetectionModel || !this.faceLandmarkModel || !this.faceRecognitionModel) {
        console.log('Face recognition models could not be loaded');
        return { totalImages: 0, processedImages: 0, personsIdentified: 0 };
      }
    }
    
    let totalImages = 0;
    let processedImages = 0;
    
    try {
      // Get all image files from events directory
      const eventFiles = fs.existsSync(eventsDir) ? 
        fs.readdirSync(eventsDir)
          .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg'))
          .map(file => path.join(eventsDir, file)) : [];
      
      // Get all image files from snapshots directory
      const snapshotFiles = fs.existsSync(snapshotsDir) ? 
        fs.readdirSync(snapshotsDir)
          .filter(file => file.endsWith('.jpg') || file.endsWith('.jpeg'))
          .map(file => path.join(snapshotsDir, file)) : [];
      
      // Combine all image files
      const allImageFiles = [...eventFiles, ...snapshotFiles];
      totalImages = allImageFiles.length;
      
      console.log(`Processing ${totalImages} images...`);
      
      // Process each image
      for (const imagePath of allImageFiles) {
        await this.processImage(imagePath);
        processedImages++;
        
        // Log progress every 10 images
        if (processedImages % 10 === 0) {
          console.log(`Processed ${processedImages}/${totalImages} images`);
        }
      }
      
      console.log(`Completed processing ${processedImages}/${totalImages} images`);
      console.log(`Identified ${identifiedPersons.size} unique persons`);
      
      return {
        totalImages,
        processedImages,
        personsIdentified: identifiedPersons.size
      };
    } catch (error) {
      console.error('Error processing images:', error);
      return {
        totalImages,
        processedImages,
        personsIdentified: identifiedPersons.size
      };
    }
  }

  // Get all identified persons
  public getIdentifiedPersons(): Person[] {
    return Array.from(identifiedPersons.values());
  }
}

// Create and export face recognition instance
export const faceRecognition = new FaceRecognition();