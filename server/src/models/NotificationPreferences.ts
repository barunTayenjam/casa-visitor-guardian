import { Entity, PrimaryGeneratedColumn, Column, OneToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User.js';

@Entity('notification_preferences')
@Index(['userId'])
export class NotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ name: 'motion_enabled', type: 'boolean', default: true })
  motionEnabled!: boolean;

  @Column({ name: 'face_enabled', type: 'boolean', default: true })
  faceEnabled!: boolean;

  @Column({ name: 'object_enabled', type: 'boolean', default: true })
  objectEnabled!: boolean;

  @Column({ name: 'quiet_hours_enabled', type: 'boolean', default: false })
  quietHoursEnabled!: boolean;

  @Column({ name: 'quiet_hours_start', type: 'time', default: '22:00' })
  quietHoursStart!: string;

  @Column({ name: 'quiet_hours_end', type: 'time', default: '06:00' })
  quietHoursEnd!: string;

  @Column({ name: 'quiet_hours_timezone', type: 'text', default: 'Asia/Kolkata' })
  quietHoursTimezone!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'NOW()' })
  updatedAt!: Date;
}
