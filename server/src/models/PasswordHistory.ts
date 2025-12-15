// File: server/src/models/PasswordHistory.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, Index } from 'typeorm';
import { User } from './User.js';

@Entity('password_history')
@Index(['userId'])
export class PasswordHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, user => (user as any).passwordHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;

  @Column({ length: 255 })
  passwordHash!: string;

  @CreateDateColumn()
  createdAt!: Date;
}