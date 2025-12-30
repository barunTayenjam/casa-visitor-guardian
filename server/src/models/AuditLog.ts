import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { User } from './User.js';
import { UserSession } from './UserSession.js';

@Entity('audit_logs')
@Index(['userId'])
@Index(['timestamp'])
@Index(['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true })
  userId!: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user!: User | null;

  @Column({ type: 'varchar', length: 100 })
  action!: string;

  @Column({ type: 'varchar', length: 50 })
  resourceType!: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resourceId!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  oldValues!: Record<string, any> | null;

  @Column({ type: 'jsonb', nullable: true })
  newValues!: Record<string, any> | null;

  @Column({ type: 'inet', nullable: true })
  ipAddress!: string | null;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'uuid', nullable: true })
  sessionId!: string | null;

  @ManyToOne(() => UserSession, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'session_id' })
  session!: UserSession | null;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  severity!: 'debug' | 'info' | 'warning' | 'error' | 'critical';

  @Column({ type: 'jsonb', default: () => '{}' })
  metadata!: Record<string, any>;

  @CreateDateColumn()
  timestamp!: Date;
}
