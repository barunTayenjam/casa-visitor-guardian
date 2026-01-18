import { Entity, Column, PrimaryColumn, CreateDateColumn } from 'typeorm';

@Entity('user_review_status')
export class UserReviewStatus {
  @PrimaryColumn({ type: 'varchar', length: 30, comment: 'User ID' })
  user_id!: string;

  @PrimaryColumn({ type: 'varchar', length: 30, comment: 'Review segment ID' })
  review_segment_id!: string;

  @Column({ type: 'boolean', default: false, comment: 'Has been reviewed' })
  has_been_reviewed!: boolean;

  @Column({ type: 'timestamptz', nullable: true, comment: 'Review timestamp' })
  reviewed_at!: Date | null;

  @CreateDateColumn({ name: 'created_at', comment: 'Record creation time' })
  created_at!: Date;
}
