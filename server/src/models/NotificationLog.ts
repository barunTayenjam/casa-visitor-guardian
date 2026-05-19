import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User.js';
import { Event } from './Event.js';

@Entity('notification_logs')
@Index(['userId'])
@Index(['eventId'])
@Index(['status'])
@Index(['sentAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId!: string | null;

  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event!: Event | null;

  @Column({ type: 'text' })
  type!: string;

  @Column({ type: 'jsonb', nullable: true })
  payload!: Record<string, any> | null;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;

  @Column({ type: 'text', default: 'pending' })
  status!: 'success' | 'failed' | 'pending';

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @Column({ name: 'retry_count', type: 'integer', default: 0 })
  retryCount!: number;
}
