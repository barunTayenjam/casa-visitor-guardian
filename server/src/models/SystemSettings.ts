import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSettings {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 100, default: 'Security System' })
  systemName!: string;

  @Column({ type: 'varchar', length: 50, default: 'UTC' })
  timezone!: string;

  @Column({ type: 'varchar', length: 10, default: 'en' })
  language!: string;

  @Column({ type: 'varchar', length: 20, default: 'system' })
  theme!: string;

  @Column({ type: 'boolean', default: true })
  autoBackup!: boolean;

  @Column({ type: 'varchar', length: 20, default: 'daily' })
  backupFrequency!: string;

  @Column({ type: 'integer', default: 30 })
  retentionDays!: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 100 })
  maxStorageGB!: number;

  @Column({ type: 'boolean', default: true })
  autoCleanup!: boolean;

  @Column({ type: 'boolean', default: true })
  compressionEnabled!: boolean;

  @Column({ type: 'integer', default: 80 })
  compressionQuality!: number;

  @Column({ type: 'boolean', default: false })
  emailEnabled!: boolean;

  @Column({ type: 'varchar', length: 255, default: '' })
  emailAddress!: string;

  @Column({ type: 'boolean', default: true })
  pushEnabled!: boolean;

  @Column({ type: 'boolean', default: true })
  pushSoundEnabled!: boolean;

  @Column({ type: 'boolean', default: false })
  quietHoursEnabled!: boolean;

  @Column({ type: 'varchar', length: 10, default: '22:00' })
  quietHoursStart!: string;

  @Column({ type: 'varchar', length: 10, default: '07:00' })
  quietHoursEnd!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
