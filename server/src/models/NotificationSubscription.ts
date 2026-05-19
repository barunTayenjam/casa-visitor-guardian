import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User.js';

@Entity('notification_subscriptions')
@Index(['userId'])
@Index(['isActive'])
export class NotificationSubscription {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column('text')
  endpoint!: string;

  @Column({ name: 'keys_p256h', type: 'text' })
  keysP256h!: string;

  @Column({ name: 'keys_auth', type: 'text' })
  keysAuth!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'last_used', type: 'timestamp', default: () => 'NOW()' })
  lastUsed!: Date;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;
}
