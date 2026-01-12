import { detectionCleanupService } from './cleanupService.js';
import { consolidatedDetectionService } from './consolidatedDetectionService.js';
import { setupOptimizedMotionDetection, cleanupOptimizedMotionDetection } from './optimizedMotionDetection.js';

/**
 * Test suite for ML Model Optimization resource management
 */
export class MLModelOptimizationTests {
  private static instance: MLModelOptimizationTests;
  private testResults: Map<string, boolean> = new Map();

  private constructor() {
    console.log('MLModelOptimizationTests: Initializing test suite');
  }

  static getInstance(): MLModelOptimizationTests {
    if (!MLModelOptimizationTests.instance) {
      MLModelOptimizationTests.instance = new MLModelOptimizationTests();
    }
    return MLModelOptimizationTests.instance;
  }

  /**
   * Run all resource management tests
   */
  async runAllTests(): Promise<Map<string, boolean>> {
    console.log('Running ML Model Optimization resource management tests...');

    try {
      // Test consolidated detection cleanup
      await this.testConsolidatedDetection();

      // Test optimized motion detection cleanup
      await this.testOptimizedMotionDetection();

      // Test cleanup service
      await this.testCleanupService();

      console.log('All ML Model Optimization tests completed');
      return this.testResults;
    } catch (error) {
      console.error('Error running ML Model Optimization tests:', error);
      return this.testResults;
    }
  }

  /**
   * Test consolidated detection resource management
   */
  private async testConsolidatedDetection(): Promise<void> {
    const testName = 'ConsolidatedDetectionCleanup';

    try {
      // Test cleanup hook
      await consolidatedDetectionService.cleanupHook();

      this.testResults.set(testName, true);
      console.log(`✓ ${testName} passed`);
    } catch (error) {
      this.testResults.set(testName, false);
      console.error(`✗ ${testName} failed:`, error);
    }
  }

  /**
   * Test optimized motion detection resource management
   */
  private async testOptimizedMotionDetection(): Promise<void> {
    const testName = 'OptimizedMotionDetectionCleanup';

    try {
      // Test cleanup function
      await cleanupOptimizedMotionDetection();

      this.testResults.set(testName, true);
      console.log(`✓ ${testName} passed`);
    } catch (error) {
      this.testResults.set(testName, false);
      console.error(`✗ ${testName} failed:`, error);
    }
  }

  /**
   * Test cleanup service
   */
  private async testCleanupService(): Promise<void> {
    const testName = 'CleanupService';

    try {
      // Initialize cleanup service
      await detectionCleanupService.initialize();

      // Test cleanup all
      await detectionCleanupService.cleanupAll();

      this.testResults.set(testName, true);
      console.log(`✓ ${testName} passed`);
    } catch (error) {
      this.testResults.set(testName, false);
      console.error(`✗ ${testName} failed:`, error);
    }
  }

  /**
   * Get test results
   */
  getResults(): Map<string, boolean> {
    return this.testResults;
  }

  /**
   * Print test summary
   */
  printSummary(): void {
    console.log('\nML Model Optimization Test Summary:');
    console.log('==============================');

    let passed = 0;
    let failed = 0;

    for (const [testName, result] of this.testResults) {
      console.log(`${result ? '✓' : '✗'} ${testName}`);
      if (result) passed++;
      else failed++;
    }

    console.log(`\nPassed: ${passed}/${this.testResults.size}`);
    console.log(`Failed: ${failed}/${this.testResults.size}`);
    console.log(`Success rate: ${((passed / this.testResults.size) * 100).toFixed(1)}%`);
  }
}

// Export test suite
export const mlModelOptimizationTests = MLModelOptimizationTests.getInstance();
export default mlModelOptimizationTests;
