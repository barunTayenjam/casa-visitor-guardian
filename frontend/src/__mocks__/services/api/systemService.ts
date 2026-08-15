export const systemService = {
  getDaySummary: jest.fn().mockResolvedValue({
    success: true,
    summary: {
      totalEvents: 1,
      totalPersons: 1,
      totalFaces: 0,
      knownFaces: 0,
      knownEvents: 0,
      unknownEvents: 1,
      nightEvents: 0,
    },
  }),
  getTimelapses: jest.fn().mockResolvedValue({
    success: true,
    timelapses: [],
  }),
};
