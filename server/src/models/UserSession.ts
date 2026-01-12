import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, CreateDateColumn, Index, ManyToOne, OneToMany, JoinTable } from 'typeorm';
import { User } from './User.js';

@Entity('user_sessions')
@Index(['userId'])
@Index(['refreshToken'])
@Index(['expiresAt'])
export class UserSession {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user!: User;

  @Column({ type: 'varchar', length: 255, unique: true })
  refreshToken!: string;

  @Column({ type: 'varchar', length: 255 })
  accessTokenHash!: string;

  @Column({ type: 'jsonb', default: () => '{}' })
  deviceInfo!: Record<string, any>;

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
