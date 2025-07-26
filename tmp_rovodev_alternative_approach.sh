#!/bin/bash

echo "=== Alternative: Disable TensorFlow and Use Mock Detection ==="

cd server

echo "Creating mock person detection that always works..."

# Create a backup of the original file
cp src/detection/personDetection.ts src/detection/personDetection.ts.backup

# Create a simplified version that doesn't use TensorFlow
cat > src/detection/personDetection.ts << 'EOF'
import { Server as SocketIOServer } from 'socket.io';

export let personDetectionAvailable = true; // Force to true

export class PersonDetector {
  private model: any = null;
  private isInitialized = false;

  constructor() {
    console.log('Mock PersonDetector initialized');
    this.isInitialized = true;
  }

  async initialize(): Promise<void> {
    console.log('Mock person detection initialized successfully');
    this.isInitialized = true;
    personDetectionAvailable = true;
  }

  async detectPersons(imageBuffer: Buffer): Promise<any> {
    // Mock detection - randomly detect persons for testing
    const mockDetected = Math.random() > 0.7; // 30% chance of detection
    
    return {
      personDetected: mockDetected,
      personCount: mockDetected ? 1 : 0,
      confidence: mockDetected ? 0.85 : 0,
      detectionBoxes: mockDetected ? [{
        x: 100, y: 100, width: 200, height: 300, confidence: 0.85
      }] : []
    };
  }

  isReady(): boolean {
    return this.isInitialized;
  }

  async createAnnotatedImage(imageBuffer: Buffer, boxes: any[], outputPath: string): Promise<void> {
    // Mock - just copy the original image
    const fs = await import('fs');
    fs.writeFileSync(outputPath, imageBuffer);
  }
}

export const personDetection = new PersonDetector();

// Initialize immediately
personDetection.initialize().then(() => {
  console.log('✅ Mock person detection ready');
}).catch(err => {
  console.error('❌ Mock person detection failed:', err);
});
EOF

echo "Mock person detection created. This will allow the frontend to work while we fix TensorFlow."
echo "Restart the server with: npm run dev"
echo ""
echo "To restore original TensorFlow detection later, run:"
echo "mv src/detection/personDetection.ts.backup src/detection/personDetection.ts"