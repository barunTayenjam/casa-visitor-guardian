// Re-export barrel for backward compatibility
// All implementations moved to domain-specific service modules in services/api/

export { apiClient, ApiError, NetworkError, TimeoutError, getAuthToken, setAuthToken, fetchWithRetry, API_URL } from './api/baseClient.js';
export { authService } from './api/authService.js';
export { cameraService } from './api/cameraService.js';
export { eventService } from './api/eventService.js';
export { visitorService } from './api/visitorService.js';
export { settingsService } from './api/settingsService.js';
export { detectionService } from './api/detectionService.js';
export { reviewService } from './api/reviewService.js';
export { systemService } from './api/systemService.js';

// Default export for backward compatibility (use domain-specific services instead)
export { cameraService as default } from './api/cameraService.js';
