import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('retention_policies')
export class RetentionPolicy {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true, comment: 'Camera name (null for global)' })
  camera!: string | null;

  @Column({ type: 'integer', default: 30, comment: 'Days to retain alerts' })
  alerts_days!: number;

  @Column({ type: 'integer', default: 7, comment: 'Days to retain detections' })
  detections_days!: number;

  @Column({ type: 'integer', default: 7, comment: 'Days to retain previews' })
  previews_days!: number;

  @Column({ type: 'integer', default: 30, comment: 'Days to retain snapshots' })
  snapshots_days!: number;

  @Column({ type: 'integer', default: 30, comment: 'Days to retain events' })
  events_days!: number;

  @Column({ type: 'boolean', default: false, comment: 'Retain indefinitely' })
  retain_indefinitely!: boolean;

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  created_at!: Date;

  @UpdateDateColumn({ name: 'updated_at', comment: 'Last update time' })
  updated_at!: Date;
}
