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
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, user => user.auditLogs, { nullable: true })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ length: 100 })
  action!: string;

  @Column({ length: 50 })
  resourceType!: string;

  @Column({ length: 255, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValues!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValues!: Record<string, unknown> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @ManyToOne(() => Session, { nullable: true })
  @JoinColumn({ name: 'session_id' })
  session!: Session | null;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'info',
    enum: ['debug', 'info', 'warning', 'error', 'critical']
  })
  severity!: 'debug' | 'info' | 'warning' | 'error' | 'critical';

  @Column({ type: 'jsonb', default: () => '{}' })
  metadata!: Record<string, unknown>;

  @CreateDateColumn()
  timestamp!: Date;

  @Column({ length: 64, nullable: true })
  signature!: string | null;
}