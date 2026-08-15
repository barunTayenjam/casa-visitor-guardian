export const detectionService = {
  analyzeEvent: jest.fn().mockResolvedValue({
    success: true,
    analysis: {
      overall_summary: 'Test summary',
      threatAssessment: { level: 'low', factors: [], confidence: 0.9 },
    },
  }),
  analyzeEventWithBboxes: jest.fn().mockResolvedValue({
    success: true,
    boxes: [],
  }),
};
