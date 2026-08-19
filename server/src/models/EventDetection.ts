import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Event } from './Event.js';

@Entity('event_detections')
@Index(['timestamp'])
@Index(['class'])
@Index(['camera_id'])
export class EventDetection {
  @PrimaryGeneratedColumn()
  id!: number;

  @Index()
  @Column({ type: 'uuid' })
  event_id!: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id' })
  event!: Event;

  @Column({ type: 'varchar', length: 100, nullable: true })
  camera_id!: string | null;

  @Column({ type: 'timestamptz' })
  timestamp!: Date;

  @Column({ type: 'varchar', length: 50 })
  class!: string;

  @Column({ type: 'integer', nullable: true })
  class_id!: number | null;

  @Column({ type: 'float', nullable: true })
  confidence!: number | null;

  @Column({ type: 'integer', nullable: true })
  bbox_x!: number | null;

  @Column({ type: 'integer', nullable: true })
  bbox_y!: number | null;

  @Column({ type: 'integer', nullable: true })
  bbox_w!: number | null;

  @Column({ type: 'integer', nullable: true })
  bbox_h!: number | null;

  @Column({ type: 'integer', nullable: true })
  track_id!: number | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  track_state!: string | null;

  @Column({ type: 'integer', nullable: true })
  tracklet_len!: number | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  identity!: string | null;

  @Column({ type: 'float', nullable: true })
  identity_confidence!: number | null;

  @Column({ type: 'boolean', nullable: true })
  human_verified!: boolean | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  verification_tier!: string | null;

  @Column({ type: 'jsonb', nullable: true, comment: 'PersonAnalyzer output (clothing, facing, distance, carrying_item, position)' })
  person_attributes!: Record<string, unknown> | null;

  @Column({ type: 'jsonb', nullable: true, comment: 'L2-normalized face embedding vector (512-dim ArcFace)' })
  face_embedding!: number[] | null;

  @CreateDateColumn({ name: 'created_at' })
  created_at!: Date;
}