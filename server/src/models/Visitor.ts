import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('visitor_reports')
@Index(['reportType', 'periodStart'])
export class VisitorReport {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'report_type' })
  reportType!: 'daily' | 'weekly' | 'monthly';

  @Column({ type: 'text', name: 'period_start' })
  periodStart!: string;

  @Column({ type: 'text', name: 'period_end' })
  periodEnd!: string;

  @Column({ type: 'integer', name: 'total_visits', default: 0 })
  totalVisits!: number;

  @Column({ type: 'integer', name: 'unique_visitors', default: 0 })
  uniqueVisitors!: number;

  @Column({ type: 'integer', name: 'known_visitors', default: 0 })
  knownVisitors!: number;

  @Column({ type: 'integer', name: 'unknown_visitors', default: 0 })
  unknownVisitors!: number;

  @Column({ type: 'text', name: 'report_data' })
  reportData!: string;

  @Column({ type: 'text', name: 'file_path', nullable: true })
  filePath!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}

@Entity('visitor_schedules')
@Index(['enabled'])
export class VisitorSchedule {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text', name: 'report_type' })
  reportType!: 'daily' | 'weekly' | 'monthly';

  @Column({ type: 'text', name: 'cron_expression' })
  cronExpression!: string;

  @Column({ type: 'text', name: 'recipients' })
  recipients!: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}

@Entity('visitor_timeline')
@Index(['date'])
@Index(['cameraId'])
@Index(['visitorType'])
@Index(['firstSeen'])
export class VisitorTimeline {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  date!: string;

  @Column({ type: 'text', name: 'camera_id' })
  cameraId!: string;

  @Column({ type: 'text', name: 'visitor_type' })
  visitorType!: 'known' | 'unknown';

  @Column({ type: 'text', name: 'visitor_id', nullable: true })
  visitorId!: string | null;

  @Column({ type: 'text', name: 'visitor_name', nullable: true })
  visitorName!: string | null;

  @Column({ type: 'timestamp', name: 'first_seen' })
  firstSeen!: Date;

  @Column({ type: 'timestamp', name: 'last_seen' })
  lastSeen!: Date;

  @Column({ type: 'integer', name: 'duration_minutes', default: 0 })
  durationMinutes!: number;

  @Column({ type: 'float', name: 'confidence', default: 0.0 })
  confidence!: number;

  @Column({ type: 'integer', name: 'visit_count', default: 1 })
  visitCount!: number;

  @Column({ type: 'text', name: 'photo_paths', nullable: true })
  photoPaths!: string | null;

  @Column({ type: 'text', name: 'camera_ids', nullable: true })
  cameraIds!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
