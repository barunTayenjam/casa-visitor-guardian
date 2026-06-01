// File: server/src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-transformer';

import { AuditLog } from './AuditLog.js';
import { PasswordHistory } from './PasswordHistory.js';
import { Role } from './Role.js';
import { UserSession } from './UserSession.js';

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

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  @Exclude()
  passwordHash!: string;

  @Column({ name: 'role_id', type: 'uuid', nullable: true })
  roleId!: string;

  @ManyToOne(() => Role, 'users')
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ 
    name: 'status',
    type: 'varchar', 
    length: 20, 
    default: 'active',
    enum: ['active', 'inactive', 'suspended', 'locked']
  })
  status!: 'active' | 'inactive' | 'suspended' | 'locked';

  @Column({ name: 'mfa_enabled', type: 'boolean', default: false })
  mfaEnabled!: boolean;

  @Column({ name: 'mfa_secret', type: 'varchar', length: 32, nullable: true })
  @Exclude()
  mfaSecret!: string | null;

  @Column({ name: 'backup_codes', type: 'text', array: true, nullable: true })
  @Exclude()
  backupCodes!: string[] | null;

  @Column({ name: 'last_login', type: 'timestamp', nullable: true })
  lastLogin!: Date | null;

  @Column({ name: 'failed_login_attempts', type: 'integer', default: 0 })
  failedLoginAttempts!: number;

  @Column({ name: 'locked_until', type: 'timestamp', nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy!: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy!: string | null;

  @OneToMany(() => UserSession, session => session.user)
  sessions!: UserSession[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs!: AuditLog[];

  @OneToMany(() => PasswordHistory, passwordHistory => passwordHistory.user)
  passwordHistory!: PasswordHistory[];
}