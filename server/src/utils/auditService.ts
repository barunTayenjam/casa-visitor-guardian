import { DataSource, Repository } from 'typeorm';
import { AuditLog } from '../models';
import crypto from 'node:crypto';
import { z } from 'zod';

// Zod schemas for validation
export const AuditEventSchema = z.object({
  userId: z.string().optional(),
  action: z.string().min(1).max(100),
  resource: z.string().min(1).max(100),
  resourceId: z.string().optional(),
  details: z.record(z.any()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  category: z.enum(['authentication', 'authorization', 'data_access', 'data_modification', 'system', 'security']).default('system')
});

export interface AuditEvent {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'authentication' | 'authorization' | 'data_access' | 'data_modification' | 'system' | 'security';
}

export interface AuditLogEntry extends AuditLog {
  user?: {
    id: string;
    username: string;
    email: string;
  };
}

export interface AuditFilter {
  userId?: string;
  action?: string;
  resource?: string;
  category?: string;
  severity?: string;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  limit?: number;
  offset?: number;
}

export interface AuditStatistics {
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  eventsBySeverity: Record<string, number>;
  eventsByAction: Record<string, number>;
  topIPAddresses: Array<{ ipAddress: string; count: number }>;
  recentFailures: number;
  suspiciousActivity: number;
}

export class AuditService {
  private auditLogRepository: Repository<AuditLog>;
  private integritySecret: string;
  private batchSize: number = 100;
  private batchBuffer: AuditLog[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private batchFlushInterval: number = 5000; // 5 seconds

  constructor(
    private dataSource: DataSource,
    integritySecret?: string,
    batchSize: number = 100,
    batchFlushInterval: number = 5000
  ) {
    this.auditLogRepository = dataSource.getRepository(AuditLog);
    this.integritySecret = integritySecret || process.env.AUDIT_INTEGRITY_SECRET || 
      crypto.randomBytes(64).toString('hex');
    this.batchSize = batchSize;
    this.batchFlushInterval = batchFlushInterval;
  }

  async logEvent(event: AuditEvent): Promise<AuditLog | null> {
    try {
      // Validate event
      const validatedEvent = AuditEventSchema.parse(event);

      // Create audit log entry
      const auditLog = this.auditLogRepository.create({
        userId: validatedEvent.userId,
        action: validatedEvent.action,
        resource: validatedEvent.resource,
        resourceId: validatedEvent.resourceId,
        details: validatedEvent.details || {},
        ipAddress: validatedEvent.ipAddress,
        userAgent: validatedEvent.userAgent,
        severity: validatedEvent.severity || 'medium',
        category: validatedEvent.category || 'system',
        timestamp: new Date(),
        sessionId: this.generateSessionId(validatedEvent.ipAddress, validatedEvent.userAgent)
      });

      // Generate integrity signature
      auditLog.integrityHash = this.generateIntegrityHash(auditLog);

      // Add to batch buffer
      this.batchBuffer.push(auditLog);

      // Flush batch if needed
      if (this.batchBuffer.length >= this.batchSize) {
        await this.flushBatch();
      } else if (!this.batchTimeout) {
        // Set timeout to flush batch after interval
        this.batchTimeout = setTimeout(() => {
          this.flushBatch();
        }, this.batchFlushInterval);
      }

      return auditLog;

    } catch (error) {
      console.error('Audit logging error:', error);
      return null;
    }
  }

  async flushBatch(): Promise<void> {
    try {
      if (this.batchBuffer.length === 0) {
        return;
      }

      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      // Copy buffer and clear it
      const batchToFlush = [...this.batchBuffer];
      this.batchBuffer = [];

      // Insert batch into database
      await this.auditLogRepository.insert(batchToFlush);

      console.log(`Flushed audit batch with ${batchToFlush.length} entries`);

    } catch (error) {
      console.error('Audit batch flush error:', error);
      // Re-add failed entries to buffer for retry
      // In production, you might want to implement exponential backoff
    }
  }

  async getAuditLogs(filter: AuditFilter = {}): Promise<{ logs: AuditLogEntry[]; total: number }> {
    try {
      const queryBuilder = this.auditLogRepository
        .createQueryBuilder('audit')
        .leftJoinAndSelect('audit.user', 'user')
        .orderBy('audit.timestamp', 'DESC');

      // Apply filters
      if (filter.userId) {
        queryBuilder.andWhere('audit.userId = :userId', { userId: filter.userId });
      }

      if (filter.action) {
        queryBuilder.andWhere('audit.action = :action', { action: filter.action });
      }

      if (filter.resource) {
        queryBuilder.andWhere('audit.resource = :resource', { resource: filter.resource });
      }

      if (filter.category) {
        queryBuilder.andWhere('audit.category = :category', { category: filter.category });
      }

      if (filter.severity) {
        queryBuilder.andWhere('audit.severity = :severity', { severity: filter.severity });
      }

      if (filter.ipAddress) {
        queryBuilder.andWhere('audit.ipAddress = :ipAddress', { ipAddress: filter.ipAddress });
      }

      if (filter.startDate) {
        queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: filter.startDate });
      }

      if (filter.endDate) {
        queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: filter.endDate });
      }

      // Get total count
      const total = await queryBuilder.getCount();

      // Apply pagination
      if (filter.limit) {
        queryBuilder.limit(filter.limit);
      }

      if (filter.offset) {
        queryBuilder.offset(filter.offset);
      }

      // Execute query
      const logs = await queryBuilder.getMany();

      // Verify integrity of each log
      const verifiedLogs = logs.filter(log => this.verifyIntegrity(log));

      return { logs: verifiedLogs, total };

    } catch (error) {
      console.error('Get audit logs error:', error);
      return { logs: [], total: 0 };
    }
  }

  async getAuditStatistics(filter: Partial<AuditFilter> = {}): Promise<AuditStatistics> {
    try {
      const queryBuilder = this.auditLogRepository.createQueryBuilder('audit');

      // Apply date filters
      if (filter.startDate) {
        queryBuilder.andWhere('audit.timestamp >= :startDate', { startDate: filter.startDate });
      }

      if (filter.endDate) {
        queryBuilder.andWhere('audit.timestamp <= :endDate', { endDate: filter.endDate });
      }

      // Get total events
      const totalEvents = await queryBuilder.getCount();

      // Get events by category
      const eventsByCategory = await queryBuilder
        .select('audit.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.category')
        .getRawMany()
        .then(results => results.reduce((acc, row) => {
          acc[row.category] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>));

      // Get events by severity
      const eventsBySeverity = await queryBuilder
        .select('audit.severity', 'severity')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.severity')
        .getRawMany()
        .then(results => results.reduce((acc, row) => {
          acc[row.severity] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>));

      // Get events by action (top 10)
      const eventsByAction = await queryBuilder
        .select('audit.action', 'action')
        .addSelect('COUNT(*)', 'count')
        .groupBy('audit.action')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany()
        .then(results => results.reduce((acc, row) => {
          acc[row.action] = parseInt(row.count);
          return acc;
        }, {} as Record<string, number>));

      // Get top IP addresses
      const topIPAddresses = await queryBuilder
        .select('audit.ipAddress', 'ipAddress')
        .addSelect('COUNT(*)', 'count')
        .where('audit.ipAddress IS NOT NULL')
        .groupBy('audit.ipAddress')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany()
        .then(results => results.map(row => ({
          ipAddress: row.ipAddress,
          count: parseInt(row.count)
        })));

      // Get recent failures (last 24 hours)
      const recentFailures = await queryBuilder
        .clone()
        .andWhere('audit.action LIKE :failedAction', { failedAction: '%FAILED%' })
        .andWhere('audit.timestamp >= :yesterday', { 
          yesterday: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        })
        .getCount();

      // Get suspicious activity (multiple failed logins from same IP)
      const suspiciousActivity = await queryBuilder
        .select('audit.ipAddress', 'ipAddress')
        .addSelect('COUNT(*)', 'count')
        .where('audit.action = :action', { action: 'LOGIN_FAILED' })
        .andWhere('audit.timestamp >= :yesterday', { 
          yesterday: new Date(Date.now() - 24 * 60 * 60 * 1000) 
        })
        .groupBy('audit.ipAddress')
        .having('COUNT(*) > :threshold', { threshold: 5 })
        .getCount();

      return {
        totalEvents,
        eventsByCategory,
        eventsBySeverity,
        eventsByAction,
        topIPAddresses,
        recentFailures,
        suspiciousActivity
      };

    } catch (error) {
      console.error('Get audit statistics error:', error);
      return {
        totalEvents: 0,
        eventsByCategory: {},
        eventsBySeverity: {},
        eventsByAction: {},
        topIPAddresses: [],
        recentFailures: 0,
        suspiciousActivity: 0
      };
    }
  }

  async verifyAuditLogIntegrity(logId: string): Promise<boolean> {
    try {
      const log = await this.auditLogRepository.findOne({ where: { id: logId } });
      if (!log) {
        return false;
      }

      return this.verifyIntegrity(log);

    } catch (error) {
      console.error('Verify audit log integrity error:', error);
      return false;
    }
  }

  async cleanupOldLogs(daysToKeep: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
      
      const result = await this.auditLogRepository
        .createQueryBuilder()
        .delete()
        .where('timestamp < :cutoffDate', { cutoffDate })
        .execute();

      const deletedCount = result.affected || 0;
      console.log(`Cleaned up ${deletedCount} old audit logs`);
      
      return deletedCount;

    } catch (error) {
      console.error('Audit log cleanup error:', error);
      return 0;
    }
  }

  private generateIntegrityHash(auditLog: AuditLog): string {
    const data = [
      auditLog.userId || '',
      auditLog.action,
      auditLog.resource,
      auditLog.resourceId || '',
      JSON.stringify(auditLog.details || {}),
      auditLog.ipAddress || '',
      auditLog.userAgent || '',
      auditLog.severity,
      auditLog.category,
      auditLog.timestamp.toISOString(),
      auditLog.sessionId || ''
    ].join('|');

    return crypto
      .createHmac('sha256', this.integritySecret)
      .update(data)
      .digest('hex');
  }

  private verifyIntegrity(auditLog: AuditLog): boolean {
    if (!auditLog.integrityHash) {
      return false;
    }

    const expectedHash = this.generateIntegrityHash(auditLog);
    return auditLog.integrityHash === expectedHash;
  }

  private generateSessionId(ipAddress?: string, userAgent?: string): string {
    const data = `${ipAddress || ''}-${userAgent || ''}-${Date.now()}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
  }

  // Force flush any pending batch
  async destroy(): Promise<void> {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.batchTimeout = null;
    }
    await this.flushBatch();
  }
}