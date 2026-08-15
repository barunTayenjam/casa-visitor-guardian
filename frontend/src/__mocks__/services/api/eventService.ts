export const eventService = {
  getEnhancedEventsList: jest.fn().mockResolvedValue({
    events: [
      {
        id: 'evt-1',
        cameraId: 'cam-1',
        cameraName: 'Front Door',
        timestamp: '2026-08-14T10:00:00Z',
        imageUrl: '/test.jpg',
        confidence: 0.95,
        event_type: 'person',
        severity: 'info',
        persons_detected: 1,
        faces_detected: 0,
        known_faces_count: 0,
        unknown_faces_count: 0,
      },
    ],
    pagination: {
      totalPages: 1,
      totalEvents: 1,
    },
  }),
  getDailyStats: jest.fn().mockResolvedValue(1),
  archiveEvent: jest.fn().mockResolvedValue({ success: true }),
};
