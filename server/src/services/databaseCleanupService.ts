import { AppDataSource } from '../database.js';

export class DatabaseCleanupService {
  private static instance: DatabaseCleanupService;

  static getInstance(): DatabaseCleanupService {
    if (!DatabaseCleanupService.instance) {
      DatabaseCleanupService.instance = new DatabaseCleanupService();
    }
    return DatabaseCleanupService.instance;
  }

  async startScheduledCleanup(): void {
    setInterval(async () => {
      await this.cleanupOldRecords();
    }, 60 * 60 * 1000);

    console.log('Database cleanup service started');
  }

  private async cleanupOldRecords(): Promise<void> {
    try {
      const deletedFiles = await AppDataSource.query(
        'SELECT cleanup_old_detection_files(7) as deleted'
      );

      const archivedEvents = await AppDataSource.query(
        'SELECT archive_old_events(30) as archived'
      );

      const deletedArchivedEvents = await AppDataSource.query(
        'SELECT cleanup_archived_events(90) as deleted'
      );

      console.log(
        `Database cleanup: Deleted ${deletedFiles[0].deleted} files, ` +
        `archived ${archivedEvents[0].archived} events, ` +
        `deleted ${deletedArchivedEvents[0].deleted} archived events`
      );
    } catch (error) {
      console.error('Database cleanup error:', error);
    }
  }

  async manualCleanup(): Promise<{ filesDeleted: number; eventsArchived: number; archivedDeleted: number }> {
    try {
      const filesDeleted = await AppDataSource.query(
        'SELECT cleanup_old_detection_files(7) as count'
      );

      const eventsArchived = await AppDataSource.query(
        'SELECT archive_old_events(30) as count'
      );

      const archivedDeleted = await AppDataSource.query(
        'SELECT cleanup_archived_events(90) as count'
      );

      return {
        filesDeleted: filesDeleted[0].count,
        eventsArchived: eventsArchived[0].count,
        archivedDeleted: archivedDeleted[0].count
      };
    } catch (error) {
      console.error('Manual cleanup error:', error);
      throw error;
    }
  }
}

export const databaseCleanupService = DatabaseCleanupService.getInstance();
