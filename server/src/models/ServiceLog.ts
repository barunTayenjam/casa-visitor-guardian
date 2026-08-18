import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('service_logs')
@Index(['timestamp'])
@Index(['service'])
@Index(['level'])
export class ServiceLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  service!: string;

  @Column({ type: 'varchar', length: 16 })
  level!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  module?: string;

  @Column({ name: 'camera_id', type: 'varchar', length: 64, nullable: true })
  cameraId?: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: object;

  @CreateDateColumn()
  timestamp!: Date;
}
