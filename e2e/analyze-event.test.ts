import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:9753';
const API_BASE = `${BASE_URL}/api`;

// JWT credentials for the 'tester' account (created in DB for E2E testing)
const TESTER_CREDS = {
  username: 'tester',
  password: 'Correct-Horse-1!',
};

// Event ID from the PostgreSQL events table
const EVENT_ID = 'befecacd-2490-4648-8321-56dc438432b0';

test.describe('NVIDIA AI Analysis E2E', () => {
  test('should return analysis for an event via /api/nvidia/analyze-event', async ({
    request,
  }) => {
    // Step 1: Login to get auth token
    const loginResp = await request.post(`${API_BASE}/auth/login`, {
      data: {
        username: TESTER_CREDS.username,
        password: TESTER_CREDS.password,
      },
    });

    expect(loginResp.status()).toBe(200);
    const loginBody = await loginResp.json();
    const token = loginBody.token || loginBody.access_token;
    expect(token).toBeTruthy();

    // Step 2: Call analyze-event with the eventId
    const resp = await request.post(`${API_BASE}/nvidia/analyze-event`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        eventId: EVENT_ID,
      },
    });

    // Step 3: Verify response status
    expect(resp.status()).toBe(200);
    const body = await resp.json();

    // Step 4: Verify success structure
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('analysis');
    expect(body.analysis).toHaveProperty('sceneDescription');
    expect(body.analysis).toHaveProperty('threatAssessment');
    expect(body.analysis.threatAssessment).toHaveProperty('level');
    expect(body.analysis).toHaveProperty('boundingBoxes');

    // Step 5: Verify analysis has substance
    expect(body.analysis.sceneDescription).toBeTruthy();
    expect(body.analysis.sceneDescription.length).toBeGreaterThan(10);

    // Step 6: Verify bounding boxes have valid percentages (0-100)
    const boxes = body.analysis.boundingBoxes || [];
    for (const box of boxes) {
      expect(box).toHaveProperty('x');
      expect(box).toHaveProperty('y');
      expect(box).toHaveProperty('width');
      expect(box).toHaveProperty('height');
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x).toBeLessThanOrEqual(100);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeLessThanOrEqual(100);
      expect(box.width).toBeGreaterThanOrEqual(0);
      expect(box.width).toBeLessThanOrEqual(100);
      expect(box.height).toBeGreaterThanOrEqual(0);
      expect(box.height).toBeLessThanOrEqual(100);
    }

    // Step 7: Verify event context
    expect(body).toHaveProperty('event');
    expect(body.event).toHaveProperty('id', EVENT_ID);
    expect(body.event).toHaveProperty('eventType');
    expect(body.event).toHaveProperty('cameraId');

    // Step 8: Verify threat assessment
    expect(body.analysis.threatAssessment).toHaveProperty('level');
    expect(body.analysis.threatAssessment).toHaveProperty('confidence');
    expect(body.analysis.threatAssessment.level).toMatch(/^(low|medium|high)$/);

    // Step 9: Verify model used
    expect(body.analysis).toHaveProperty('model');
    expect(body.analysis.model).toBeTruthy();
  });
});