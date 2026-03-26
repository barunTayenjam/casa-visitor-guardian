import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index
} from 'typeorm';

export enum SecurityEventType {
  CREDENTIAL_DECRYPTION_FAILED = 'CREDENTIAL_DECRYPTION_FAILED',
  PLAINTEXT_CREDENTIALS_DETECTED = 'PLAINTEXT_CREDENTIALS_DETECTED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  UNAUTHORIZED_ACCESS_ATTEMPT = 'UNAUTHORIZED_ACCESS_ATTEMPT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

@Entity('security_events')
@Index(['eventType'])
@Index(['timestamp'])
@Index(['userId'])
export class SecurityEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: SecurityEventType;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'ip_address', type: 'varchar', length: 45, nullable: true })
  ipAddress?: string;

  @Column({ name: 'details', type: 'jsonb', nullable: true })
  details?: Record<string, unknown>;

  @CreateDateColumn({ name: 'timestamp' })
  timestamp!: Date;
}
