import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('human_verifications')
@Index(['cameraId'])
@Index(['tier'])
export class HumanVerification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId?: string;

  @Column({ name: 'camera_id', type: 'varchar', length: 64 })
  cameraId!: string;

  @Column({ name: 'track_id', type: 'varchar', length: 64, nullable: true })
  trackId?: string;

  @Column({ type: 'boolean' })
  verified!: boolean;

  @Column({ type: 'varchar', length: 16 })
  tier!: string;

  @Column({ type: 'integer', default: 0 })
  keypoints!: number;

  @Column({ name: 'face_detected', type: 'boolean', default: false })
  faceDetected!: boolean;

  @Column({ name: 'yolo_score', type: 'real', default: 0 })
  yoloScore!: number;

  @Column({ name: 'roi_width', type: 'integer', default: 0 })
  roiWidth!: number;

  @Column({ name: 'roi_height', type: 'integer', default: 0 })
  roiHeight!: number;

  @Column({ name: 'elapsed_ms', type: 'integer', default: 0 })
  elapsedMs!: number;

  @CreateDateColumn()
  timestamp!: Date;
}
