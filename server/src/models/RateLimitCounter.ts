import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index
} from 'typeorm';

@Entity('rate_limit_counters')
@Index(['userId', 'endpoint', 'windowStart'])
@Index(['windowStart'])
export class RateLimitCounter {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string;

  @Column({ name: 'endpoint', type: 'varchar', length: 255 })
  endpoint!: string;

  @Column({ type: 'integer' })
  count!: number;

  @Column({ name: 'window_start', type: 'timestamp with time zone' })
  windowStart!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
