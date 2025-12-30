import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BatchJob } from './BatchJob.js';

@Entity('processed_images')
@Index(['jobId'])
@Index(['filename'])
@Index(['cameraId'])
@Index(['processedAt'])
@Index(['fileHash'])
export class ProcessedImage {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'job_id' })
  jobId!: string;

  @ManyToOne(() => BatchJob, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'job_id' })
  batchJob!: BatchJob;

  @Column({ type: 'text' })
  filename!: string;

  @Column({ type: 'text', name: 'file_path' })
  filePath!: string;

  @Column({ type: 'text', name: 'camera_id' })
  cameraId!: string;

  @Column({ type: 'timestamp', name: 'image_timestamp' })
  imageTimestamp!: Date;

  @Column({ type: 'bigint', name: 'file_size' })
  fileSize!: number;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt!: Date;

  @Column({ type: 'integer', name: 'person_count', default: 0 })
  personCount!: number;

  @Column({ type: 'integer', name: 'face_count', default: 0 })
  faceCount!: number;

  @Column({ type: 'integer', name: 'known_face_count', default: 0 })
  knownFaceCount!: number;

  @Column({ type: 'integer', name: 'unknown_face_count', default: 0 })
  unknownFaceCount!: number;

  @Column({ type: 'integer', name: 'processing_time_ms' })
  processingTimeMs!: number;

  @Column({ type: 'text' })
  status!: 'success' | 'failed';

  @Column({ type: 'text', name: 'error_message', nullable: true })
  errorMessage!: string | null;

  @Column({ type: 'jsonb', name: 'detection_json', default: () => '{}' })
  detectionJson!: Record<string, any>;

  @Column({ type: 'text', name: 'file_hash' })
  fileHash!: string;
}
