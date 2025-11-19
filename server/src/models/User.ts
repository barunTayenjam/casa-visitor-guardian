// File: server/src/models/User.ts
import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { Exclude } from 'class-validator';
import { Session } from './Session';
import { AuditLog } from './AuditLog';
import { PasswordHistory } from './PasswordHistory';

@Entity('users')
@Index(['email'])
@Index(['username'])
@Index(['status'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 50, unique: true })
  username: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ length: 255 })
  @Exclude()
  passwordHash: string;

  @Column({ length: 32 })
  @Exclude()
  salt: string;

  @Column({ type: 'uuid', nullable: true })
  roleId: string;

  @ManyToOne('Role', 'users')
  @JoinColumn({ name: 'role_id' })
  role: any;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    default: 'active',
    enum: ['active', 'inactive', 'suspended', 'locked']
  })
  status: string;

  @Column({ type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ length: 32, nullable: true })
  @Exclude()
  mfaSecret: string;

  @Column({ type: 'text', array: true, nullable: true })
  @Exclude()
  backupCodes: string[];

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ length: 255, nullable: true })
  emailVerificationToken: string;

  @Column({ type: 'timestamp', nullable: true })
  emailVerificationExpires: Date;

  @Column({ length: 255, nullable: true })
  @Exclude()
  passwordResetToken: string;

  @Column({ type: 'timestamp', nullable: true })
  passwordResetExpires: Date;

  @Column({ type: 'timestamp', nullable: true })
  lastLogin: Date;

  @Column({ type: 'integer', default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  lockedUntil: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'uuid', nullable: true })
  createdBy: string;

  @Column({ type: 'uuid', nullable: true })
  updatedBy: string;

  @OneToMany(() => Session, session => session.user)
  sessions: Session[];

  @OneToMany(() => AuditLog, auditLog => auditLog.user)
  auditLogs: AuditLog[];

  @OneToMany(() => PasswordHistory, passwordHistory => passwordHistory.user)
  passwordHistory: PasswordHistory[];
}