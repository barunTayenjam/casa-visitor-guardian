import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('timeline')
@Index(['camera', 'timestamp'])
@Index(['source', 'source_id'])
@Index(['class_type'])
export class Timeline {
  @PrimaryColumn({ type: 'varchar', length: 30, comment: 'Timeline event ID' })
  id!: string;

  @Column({ type: 'timestamptz', comment: 'Event timestamp' })
  timestamp!: Date;

  @Column({ type: 'varchar', length: 20, comment: 'Camera name' })
  camera!: string;

  @Column({ type: 'varchar', length: 20, comment: 'Event source: tracked_object, audio, api, system' })
  source!: 'tracked_object' | 'audio' | 'api' | 'system';

  @Column({ type: 'varchar', length: 30, comment: 'Source-specific ID' })
  source_id!: string;

  @Column({ type: 'varchar', length: 50, comment: 'Event classification' })
  class_type!: string;

  @Column({ type: 'jsonb', default: {}, comment: 'Source-specific metadata' })
  data!: {
    object_id?: string;
    label?: string;
    score?: number;
    box?: { x: number; y: number; width: number; height: number };
    zone?: string;
    region?: { x: number; y: number; width: number; height: number };
    [key: string]: unknown;
  };

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  created_at!: Date;
}
