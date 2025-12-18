// File: server/src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

// import { AuditLog } from './AuditLog.js'; // Temporarily disabled
import { PasswordHistory } from './PasswordHistory.js';
import { Role } from './Role.js';

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  username!: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  passwordHash!: string;

  @Column({ type: 'varchar', length: 32 })
  @Exclude()
  salt!: string;

  @Column({ type: 'uuid', nullable: true })
  roleId!: string;

  @ManyToOne(() => Role, 'users')
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'active',
    enum: ['active', 'inactive', 'suspended', 'locked']
  })
  status!: 'active' | 'inactive' | 'suspended' | 'locked';

  @Column({ type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ type: 'varchar', length: 32, nullable: true })
  @Exclude()
  mfaSecret!: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  @Exclude()
  backupCodes!: string[] | null;

  @Column({ type: 'boolean', default: false })
  emailVerified!: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  emailVerificationToken!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires!: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  passwordResetToken!: string | null;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires!: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin!: Date | null;

  @Column({ type: 'integer', default: 0 })
  failedLoginAttempts!: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @OneToMany('Session', 'user')
  sessions!: any[];

  // @OneToMany(() => AuditLog, auditLog => auditLog.user)
  // auditLogs!: AuditLog[]; // Temporarily disabled

  @OneToMany(() => PasswordHistory, passwordHistory => passwordHistory.user)
  passwordHistory!: PasswordHistory[];
}