import cron from 'node-cron';
import { Server as SocketIOServer } from 'socket.io';

interface SchedulerConfig {
  enabled: boolean;
  cronExpression: string; // Default: '0 */12 * * *' (every 12 hours)
  options: {
    minConfidence: number;
    timeFilter: 'all' | 'hour' | 'day' | 'week' | 'month';
    saveDetectedPersons: boolean;
    cropPersonImages: boolean;
  };
}

export class BatchPersonDetectionScheduler {
  private io: SocketIOServer;
  private scheduledTask: cron.ScheduledTask | null = null;
  private config: SchedulerConfig;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.config = {
      enabled: true,
      cronExpression: '0 */12 * * *', // Every 12 hours at minute 0
      options: {
        minConfidence: 0.6,
        timeFilter: 'day', // Process last 24 hours
        saveDetectedPersons: true,
        cropPersonImages: true
      }
    };
  }

  /**
   * Start the scheduled batch detection
   */
  public start(): void {
    if (this.scheduledTask) {
      console.log('⚠️ Batch detection scheduler is already running');
      return;
    }

    if (!this.config.enabled) {
      console.log('📅 Batch detection scheduler is disabled');
      return;
    }

    console.log(`📅 Starting batch detection scheduler with cron: ${this.config.cronExpression}`);
    
    this.scheduledTask = cron.schedule(this.config.cronExpression, async () => {
      await this.runScheduledDetection();
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    console.log('✅ Batch detection scheduler started successfully');
    
    // Emit scheduler status
    this.io.emit('batchSchedulerStarted', {
      cronExpression: this.config.cronExpression,
      nextRun: this.getNextRunTime(),
      config: this.config
    });
  }

  /**
   * Stop the scheduled batch detection
   */
  public stop(): void {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
      
      console.log('🛑 Batch detection scheduler stopped');
      
      // Emit scheduler status
      this.io.emit('batchSchedulerStopped', {
        message: 'Scheduled batch detection has been stopped'
      });
    }
  }

  /**
   * Update scheduler configuration
   */
  public updateConfig(newConfig: Partial<SchedulerConfig>): void {
    const wasRunning = !!this.scheduledTask;
    
    // Stop current scheduler if running
    if (wasRunning) {
      this.stop();
    }

    // Update configuration
    this.config = { ...this.config, ...newConfig };
    
    console.log('⚙️ Batch detection scheduler configuration updated:', this.config);

    // Restart if it was running and still enabled
    if (wasRunning && this.config.enabled) {
      this.start();
    }

    // Emit configuration update
    this.io.emit('batchSchedulerConfigUpdated', {
      config: this.config,
      isRunning: !!this.scheduledTask
    });
  }

  /**
   * Get current scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    config: SchedulerConfig;
    nextRun: string | null;
    lastRun: string | null;
  } {
    return {
      isRunning: !!this.scheduledTask,
      config: this.config,
      nextRun: this.getNextRunTime(),
      lastRun: this.getLastRunTime()
    };
  }

  /**
   * Run scheduled detection
   */
  private async runScheduledDetection(): Promise<void> {
    try {
      console.log('🤖 Running scheduled batch person detection...');
      
      // Get the batch detection service
      const batchDetection = (global as any).batchPersonDetection;
      if (!batchDetection) {
        console.error('❌ Batch person detection service not available');
        return;
      }

      // Check if already processing
      const status = batchDetection.getStatus();
      if (status.isProcessing) {
        console.log('⚠️ Batch detection already running, skipping scheduled run');
        return;
      }

      // Emit scheduled run started
      this.io.emit('batchScheduledRunStarted', {
        timestamp: new Date().toISOString(),
        config: this.config.options
      });

      // Start batch processing with configured options
      const result = await batchDetection.processAllSnapshots({
        ...this.config.options,
        outputResults: true
      });

      console.log('✅ Scheduled batch detection completed successfully');
      console.log(`   📊 Processed: ${result.processedImages}/${result.totalImages} images`);
      console.log(`   👥 Found persons in: ${result.imagesWithPersons} images`);
      console.log(`   🔢 Total persons detected: ${result.personsDetected}`);

      // Emit scheduled run completed
      this.io.emit('batchScheduledRunCompleted', {
        timestamp: new Date().toISOString(),
        result: {
          totalImages: result.totalImages,
          processedImages: result.processedImages,
          personsDetected: result.personsDetected,
          imagesWithPersons: result.imagesWithPersons,
          processingTime: result.processingTime
        }
      });

      // Store last run time
      this.setLastRunTime(new Date().toISOString());

    } catch (error) {
      console.error('❌ Scheduled batch detection failed:', error);
      
      // Emit scheduled run error
      this.io.emit('batchScheduledRunError', {
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Get next scheduled run time
   */
  private getNextRunTime(): string | null {
    if (!this.scheduledTask) return null;
    
    try {
      // This is a simplified calculation - in production you might want to use a proper cron parser
      const now = new Date();
      const next = new Date(now);
      
      // For every 12 hours schedule, calculate next run
      if (this.config.cronExpression === '0 */12 * * *') {
        const currentHour = now.getHours();
        const nextHour = currentHour < 12 ? 12 : 24;
        next.setHours(nextHour, 0, 0, 0);
        
        if (nextHour === 24) {
          next.setDate(next.getDate() + 1);
          next.setHours(0, 0, 0, 0);
        }
      }
      
      return next.toISOString();
    } catch (error) {
      console.error('Error calculating next run time:', error);
      return null;
    }
  }

  /**
   * Get last run time from storage
   */
  private getLastRunTime(): string | null {
    try {
      const lastRunFile = path.join(__dirname, '../../public/batch-results/.last-scheduled-run');
      if (fs.existsSync(lastRunFile)) {
        return fs.readFileSync(lastRunFile, 'utf8').trim();
      }
    } catch (error) {
      console.error('Error reading last run time:', error);
    }
    return null;
  }

  /**
   * Store last run time
   */
  private setLastRunTime(timestamp: string): void {
    try {
      const lastRunFile = path.join(__dirname, '../../public/batch-results/.last-scheduled-run');
      const dir = path.dirname(lastRunFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(lastRunFile, timestamp);
    } catch (error) {
      console.error('Error storing last run time:', error);
    }
  }

  /**
   * Manually trigger a scheduled run (for testing)
   */
  public async triggerManualRun(): Promise<void> {
    console.log('🔧 Manually triggering scheduled batch detection...');
    await this.runScheduledDetection();
  }
}

// Export singleton instance
let batchScheduler: BatchPersonDetectionScheduler | null = null;

export function setupBatchScheduler(io: SocketIOServer): BatchPersonDetectionScheduler {
  if (!batchScheduler) {
    batchScheduler = new BatchPersonDetectionScheduler(io);
    
    // Make available globally
    (global as any).batchScheduler = batchScheduler;
    
    console.log('✅ Batch person detection scheduler initialized');
  }
  
  return batchScheduler;
}

export function getBatchScheduler(): BatchPersonDetectionScheduler | null {
  return batchScheduler;
}

// Add missing imports
import * as path from 'path';
import * as fs from 'fs';