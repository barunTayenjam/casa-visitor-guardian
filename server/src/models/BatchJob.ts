import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('batch_jobs')
@Index(['status'])
@Index(['createdAt'])
export class BatchJob {
  @PrimaryColumn({ type: 'text' })
  id!: string;

  @Column({ type: 'text' })
  status!: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

  @Column({ type: 'timestamp', nullable: true })
  startTime!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  endTime!: Date | null;

  @Column({ type: 'integer', default: 0 })
  totalImages!: number;

  @Column({ type: 'integer', default: 0 })
  processedImages!: number;

  @Column({ type: 'integer', default: 0 })
  successfulImages!: number;

  @Column({ type: 'integer', default: 0 })
  failedImages!: number;

  @Column({ type: 'integer', default: 0 })
  personDetections!: number;

  @Column({ type: 'integer', default: 0 })
  faceDetections!: number;

  @Column({ type: 'integer', default: 0 })
  knownFaces!: number;

  @Column({ type: 'integer', default: 0 })
  unknownFaces!: number;

  @Column({ type: 'integer', nullable: true })
  processingTimeMs!: number | null;

  @Column({ type: 'jsonb' })
  optionsJson!: Record<string, any>;

  @Column({ type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
