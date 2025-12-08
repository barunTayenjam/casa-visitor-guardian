// File: server/src/models/Session.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User.js';

@Entity('user_sessions')
@Index(['userId'])
@Index(['refreshToken'])
@Index(['expiresAt'])
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, user => user.sessions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 255, unique: true })
  refreshToken!: string;

  @Column({ length: 255 })
  accessTokenHash!: string;

  @Column({ type: 'jsonb', default: () => '{}' })
  deviceInfo!: Record<string, unknown>;

  @Column({ type: 'inet' })
  ipAddress!: string;

  @Column({ type: 'text', nullable: true })
  userAgent!: string | null;

  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp' })
  expiresAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastAccessed!: Date;
}