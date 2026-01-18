import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('detection_config')
export class DetectionConfig {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true, comment: 'Camera name (null for global)' })
  camera!: string | null;

  @Column({
    type: 'jsonb',
    default: {
      thresholds: {
        person: { min_score: 0.3, threshold: 0.5 },
        car: { min_score: 0.4, threshold: 0.6 },
        dog: { min_score: 0.3, threshold: 0.4 },
        package: { min_score: 0.25, threshold: 0.35 },
      },
      labelmap: {
        truck: 'car',
        bus: 'car',
        motorcycle: 'car',
      },
      score_history_length: 7,
    },
    comment: 'Detection configuration',
  })
  config!: {
    thresholds: Record<string, { min_score: number; threshold: number }>;
    labelmap: Record<string, string>;
    score_history_length: number;
  };

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: 'Last update time' })
  updated_at!: Date;
}
