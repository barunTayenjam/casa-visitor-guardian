/**
 * Event Image Classification Frontend Service
 * Provides functions to interact with the backend classification API
 */

class EventImageClassifierService {
  constructor(apiBaseUrl = '') {
    this.apiBaseUrl = apiBaseUrl;
    this.socket = null;
  }

  /**
   * Initialize the service with WebSocket connection
   */
  initialize(socket) {
    this.socket = socket;
  }

  /**
   * Get all event images
   */
  async getEventImages() {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/events/images`);
      return await response.json();
    } catch (error) {
      console.error('Error getting event images:', error);
      throw error;
    }
  }

  /**
   * Start classifying all event images
   */
  async startClassification(options) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/events/classify-all`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });
      
      return await response.json();
    } catch (error) {
      console.error('Error starting classification:', error);
      throw error;
    }
  }

  /**
   * Get classification job status
   */
  async getJobStatus(jobId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/events/classify-all/${jobId}`);
      return await response.json();
    } catch (error) {
      console.error('Error getting job status:', error);
      throw error;
    }
  }

  /**
   * Listen for classification progress updates
   */
  onProgress(callback) {
    if (this.socket) {
      this.socket.on('classificationProgress', callback);
    }
  }

  /**
   * Listen for classification completion
   */
  onCompleted(callback) {
    if (this.socket) {
      this.socket.on('classificationCompleted', callback);
    }
  }

  /**
   * Remove classification progress listener
   */
  offProgress(callback) {
    if (this.socket) {
      this.socket.off('classificationProgress', callback);
    }
  }

  /**
   * Remove classification completion listener
   */
  offCompleted(callback) {
    if (this.socket) {
      this.socket.off('classificationCompleted', callback);
    }
  }
}

// Export for use in other modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventImageClassifierService;
}

// Also make it available globally if needed
window.EventImageClassifierService = EventImageClassifierService;