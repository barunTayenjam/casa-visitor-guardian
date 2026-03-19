import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('storage_stats')
export class StorageStats {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: 'Camera name (null for global)' })
  @Index()
  camera!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'global', comment: 'Category: alerts, detections, previews, snapshots, events, global' })
  @Index()
  category!: string;

  @Column({ type: 'bigint', default: 0, comment: 'Total bytes used' })
  total_bytes!: number;

  @Column({ type: 'integer', default: 0, comment: 'Total file count' })
  file_count!: number;

  @Column({ type: 'integer', default: 0, comment: 'Oldest file age in days' })
  oldest_file_days!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: 'Growth rate in MB per day' })
  growth_rate_mb_per_day!: number;

  @Column({ type: 'jsonb', nullable: true, comment: 'Breakdown by file type' })
  breakdown!: Record<string, { bytes: number; count: number }> | null;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP', comment: 'Last calculation time' })
  @Index()
  last_calculated_at!: Date;

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  @Index()
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: 'Last update time' })
  updated_at!: Date;
}
