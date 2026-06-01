import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('review_segments')
@Index(['camera', 'start_time'])
@Index(['severity'])
export class ReviewSegment {
  @PrimaryColumn({ type: 'varchar', length: 100, comment: 'Unique segment ID' })
  id!: string;

  @Column({ type: 'varchar', length: 20, comment: 'Camera name' })
  camera!: string;

  @Column({ type: 'timestamptz', comment: 'Segment start time' })
  start_time!: Date;

  @Column({ type: 'timestamptz', comment: 'Segment end time' })
  end_time!: Date;

  @Column({ type: 'varchar', length: 30, comment: 'Severity: alert or detection' })
  severity!: 'alert' | 'detection';

  @Column({ type: 'jsonb', default: [], comment: 'Array of labels in segment' })
  labels!: string[];

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Path to thumbnail' })
  thumbnail_path!: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, comment: 'Path to preview video' })
  preview_path!: string | null;

  @Column({ type: 'jsonb', default: {}, comment: 'Additional metadata' })
  data!: {
    object_count?: number;
    objects?: Array<{
      id: string;
      label: string;
      last_seen: string;
      score: number;
    }>;
    regions?: Array<{ x: number; y: number; width: number; height: number }>;
    motion_boxes?: Array<{ x: number; y: number; width: number; height: number }>;
    has_clip?: boolean;
    has_snapshot?: boolean;
    plus_id?: string;
  };

  @Column({ type: 'boolean', default: false, comment: 'Retain indefinitely' })
  retain_indefinitely!: boolean;

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  created_at!: Date;
}
