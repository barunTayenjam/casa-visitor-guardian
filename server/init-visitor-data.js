import { visitorDatabase } from './src/services/visitorDatabase.js';
import { visitorAnalyticsService } from './src/services/visitorAnalyticsService.js';

async function initializeVisitorData() {
  try {
    console.log('Initializing visitor database...');
    await visitorDatabase.initialize();
    
    // Create some sample visitor data from recent motion events
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Sample visitor data
    const sampleVisitors = [
      {
        id: 'visitor_001',
        name: 'Delivery Person',
        type: 'unknown',
        firstSeen: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        lastSeen: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        duration: 120,
        cameraIds: ['cam1'],
        photos: ['/events/motion_cam1_2025-10-29T08-21-10-190Z.jpg'],
        confidence: 0.75,
        visitCount: 1,
        lastSeenTimestamp: now.getTime() - 2 * 60 * 60 * 1000
      },
      {
        id: 'visitor_002', 
        name: 'Family Member',
        type: 'known',
        firstSeen: new Date(yesterday.getTime() - 6 * 60 * 60 * 1000),
        lastSeen: new Date(yesterday.getTime() - 4 * 60 * 60 * 1000),
        duration: 180,
        cameraIds: ['cam1', 'cam2'],
        photos: ['/events/motion_cam1_2025-10-29T08-21-09-481Z.jpg'],
        confidence: 0.85,
        visitCount: 3,
        lastSeenTimestamp: yesterday.getTime() - 4 * 60 * 60 * 1000
      }
    ];
    
    // Store visitors in database
    for (const visitor of sampleVisitors) {
      await visitorDatabase.addVisitor(visitor);
      console.log(`Added visitor: ${visitor.name || visitor.id}`);
    }
    
    console.log('Visitor data initialized successfully');
    
  } catch (error) {
    console.error('Failed to initialize visitor data:', error);
  }
}

initializeVisitorData();