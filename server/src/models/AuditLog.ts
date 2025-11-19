// File: server/src/models/AuditLog.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { User } from './User';
import { Session } from './Session';

@Entity('audit_logs')
@Index(['userId'])
@Index(['timestamp'])
@Index(['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  userId: string;

  @ManyToOne(() => User, user => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ length: 100 })
  action: string;

  @Column({ length: 50 })
  resourceType: string;

  @Column({ length: 255, nullable: true })
  resourceId: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues: any;

  @Column({ type: 'jsonb', nullable: true })
  newValues: any;

  @Column({ type: 'inet', nullable: true })
  ipAddress: string;

  @Column({ type: 'text', nullable: true })
  userAgent: string;

  @Column({ type: 'uuid', nullable: true })
  sessionId: string;

  @ManyToOne(() => Session, session => session.id, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: Session;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'info',
    enum: ['debug', 'info', 'warning', 'error', 'critical']
  })
  severity: string;

  @Column({ type: 'jsonb', default: {} })
  metadata: any;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ length: 64, nullable: true })
  signature: string;
}